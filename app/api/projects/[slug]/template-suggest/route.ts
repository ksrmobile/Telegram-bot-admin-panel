import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "../../../../../lib/prisma";

type Params = {
  params: { slug: string };
};

type SuggestResponse = {
  runtime: "PYTHON" | "NODE" | "UNKNOWN";
  suggestedStartCommand: string | null;
  reason: string | null;
  hasDockerfile: boolean;
};

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);

  const dockerfilePath = path.join(workspace, "Dockerfile");
  const hasDockerfile = fs.existsSync(dockerfilePath);

  let runtime: SuggestResponse["runtime"] = "UNKNOWN";

  const hasRequirements = fs.existsSync(
    path.join(workspace, "requirements.txt")
  );
  const hasPyproject = fs.existsSync(
    path.join(workspace, "pyproject.toml")
  );
  const hasPackageJson = fs.existsSync(
    path.join(workspace, "package.json")
  );

  if (hasRequirements || hasPyproject) {
    runtime = "PYTHON";
  } else if (hasPackageJson) {
    runtime = "NODE";
  } else if (project.runtimeType === "PYTHON") {
    runtime = "PYTHON";
  } else if (project.runtimeType === "NODE") {
    runtime = "NODE";
  }

  let suggestedStartCommand: string | null = null;
  let reason: string | null = null;

  if (runtime === "PYTHON") {
    const candidates = ["bot.py", "main.py", "app.py", "run.py"];
    for (const name of candidates) {
      if (fs.existsSync(path.join(workspace, name))) {
        suggestedStartCommand = `python ${name}`;
        reason = `Found ${name} in project root.`;
        break;
      }
    }
  } else if (runtime === "NODE") {
    if (hasPackageJson) {
      try {
        const pkgRaw = await fs.promises.readFile(
          path.join(workspace, "package.json"),
          "utf8"
        );
        const pkg = JSON.parse(pkgRaw);
        if (pkg?.scripts?.start) {
          suggestedStartCommand = "npm run start";
          reason = "Detected package.json with a \"start\" script.";
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!suggestedStartCommand && fs.existsSync(path.join(workspace, "index.js"))) {
      suggestedStartCommand = "node index.js";
      reason = "Found index.js in project root.";
    }
  }

  const payload: SuggestResponse = {
    runtime,
    suggestedStartCommand,
    reason,
    hasDockerfile
  };

  return NextResponse.json(payload);
}

