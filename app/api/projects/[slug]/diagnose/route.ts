import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "../../../../../lib/prisma";
import { getContainerStatus, getRecentLogs } from "../../../../../lib/docker";
import { cleanLogText } from "../../../../../lib/log-sanitize";

type Params = {
  params: { slug: string };
};

type Diagnostic = {
  id: string;
  title: string;
  description: string;
  presetSuggestion?: string;
  actionHint?: "open_config" | "check_start_command";
};

async function loadEnv(pathToEnv: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.promises.readFile(pathToEnv, "utf8");
    const env: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const containerName =
    project.dockerContainerName || `ksr-bot-${project.slug}`;
  const status = await getContainerStatus(containerName);

  const logs = await getRecentLogs(containerName, 50, {
    stripAnsi: true
  });

  const diagnostics: Diagnostic[] = [];
  const joined = logs.join("\n").toLowerCase();

  if (
    joined.includes("ffmpeg not found") ||
    joined.includes("ffmpeg: command not found")
  ) {
    diagnostics.push({
      id: "ffmpeg_missing",
      title: "FFmpeg is not installed in the container",
      description:
        "Logs mention ffmpeg not found. Use a Python/Node + FFmpeg preset so FFmpeg is available for media processing.",
      presetSuggestion: "python_ffmpeg"
    });
  }

  if (
    joined.includes("failed building wheel") ||
    joined.includes("unable to execute 'gcc'") ||
    joined.includes("command 'gcc' failed") ||
    joined.includes("python.h: no such file")
  ) {
    diagnostics.push({
      id: "python_build_tools",
      title: "Missing build tools for Python wheels",
      description:
        "Logs show Python wheel build failures that need compiler and headers. Use the Python + Build Tools preset.",
      presetSuggestion: "python_build_tools"
    });
  }

  if (
    joined.includes("command not found") &&
    (joined.includes("python") ||
      joined.includes("python3") ||
      joined.includes("node"))
  ) {
    diagnostics.push({
      id: "runtime_command",
      title: "Runtime command not found",
      description:
        "The container could not find the python/node executable or script. Re-check the selected runtime and start command.",
      actionHint: "check_start_command"
    });
  }

  // Env diagnostics: BOT_TOKEN missing
  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);
  const envPath = project.envFilePath || path.join(workspace, ".env");
  const env = await loadEnv(envPath);
  if (!Object.prototype.hasOwnProperty.call(env, "BOT_TOKEN")) {
    diagnostics.push({
      id: "missing_bot_token",
      title: "BOT_TOKEN is not configured",
      description:
        "The BOT_TOKEN environment variable is missing. Set it in the Config tab (.env editor) so your bot can authenticate.",
      actionHint: "open_config"
    });
  }

  const payload = {
    status,
    lastLogs: logs,
    diagnostics,
    hasEnvFile: Object.keys(env).length > 0
  };

  return NextResponse.json(payload);
}

