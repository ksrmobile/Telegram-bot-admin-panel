import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { resolveProjectPath } from "@/lib/paths";
import {
  buildImage,
  runContainer,
  stopAndRemoveContainer,
  restartContainer,
  getContainerStatus
} from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { watchContainerForCrashes } from "@/lib/notifications";

type Params = {
  params: { slug: string };
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
  return NextResponse.json({ status, project });
}

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "start";

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ensure workspace path is absolute before passing to Docker.
  // In local dev PROJECTS_ROOT may be relative (e.g. "./data/projects"),
  // but Docker bind mounts require an absolute host path.
  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);
  const containerName =
    project.dockerContainerName || `ksr-bot-${project.slug}`;
  const runnerMode = (project as any).runnerMode || "DOCKERFILE";
  const imageName =
    project.dockerImageName ||
    (runnerMode === "TEMPLATE"
      ? `ksr-tg-panel/${project.slug}:latest`
      : `ksr-bot-img-${project.slug}`);

  try {
    if (action === "stop") {
      await stopAndRemoveContainer(containerName);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "STOPPED" }
      } as any);
      await logAudit("runner_stopped", project.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "restart") {
      await restartContainer(containerName);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "RUNNING" }
      } as any);
      await logAudit("runner_restarted", project.id);
      watchContainerForCrashes(
        { id: project.id, name: project.name, slug: project.slug },
        containerName
      );
      return NextResponse.json({ ok: true });
    }

    // action === "start"
    // For TEMPLATE mode we assume the image was built via the template
    // build endpoint. For DOCKERFILE mode we keep the existing behaviour of
    // auto-building using the workspace Dockerfile (or a simple template).
    if (runnerMode !== "TEMPLATE") {
      let dockerfileName = "Dockerfile";
      const dockerfilePath = path.join(workspace, dockerfileName);
      const hasDockerfile = fs.existsSync(dockerfilePath);

      if (!hasDockerfile) {
        dockerfileName = "Dockerfile.ksr";
        const templatePath = path.join(workspace, dockerfileName);
        if (!fs.existsSync(templatePath)) {
          const content =
            project.runtimeType === "PYTHON"
              ? `FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt || true
CMD ["sh", "-c", "${project.startCommand}"]
`
              : `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || true
COPY . .
CMD ["sh", "-c", "${project.startCommand}"]
`;
          await fs.promises.writeFile(templatePath, content, "utf8");
        }
      }

      await buildImage(workspace, dockerfileName, imageName);
    }

    const envPath =
      project.envFilePath || path.join(workspace, ".env");
    const env = await loadEnv(envPath);

    const templateWorkdir =
      (project as any).templateWorkdir && runnerMode === "TEMPLATE"
        ? ((project as any).templateWorkdir as string)
        : undefined;

    await runContainer({
      image: imageName,
      name: containerName,
      projectSlug: project.slug,
      env,
      cpuLimit: project.cpuLimit || undefined,
      memoryLimitMb: project.memoryLimitMb || undefined,
      bindPath: workspace,
      readOnly: false,
      workdir: runnerMode === "TEMPLATE" ? templateWorkdir : "/app",
      restartPolicy: "unless-stopped",
      ports:
        (project as any).templateExposePort && runnerMode === "TEMPLATE"
          ? [
              {
                containerPort: (project as any).templateExposePort,
                hostPort: (project as any).templateExposePort
              }
            ]
          : undefined
    });

    await prisma.project.update({
      where: { id: project.id },
      data: {
        dockerImageName: imageName,
        dockerContainerName: containerName,
        envFilePath: envPath,
        status: "RUNNING"
      } as any
    });

    await logAudit("runner_started", project.id);
    watchContainerForCrashes(
      { id: project.id, name: project.name, slug: project.slug },
      containerName
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Runner action error", e);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "ERROR" } as any
    });
    await logAudit("runner_error", project.id);
    return NextResponse.json(
      { error: "Runner action failed" },
      { status: 500 }
    );
  }
}

