import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { buildImageWithLogs, getDockerInfo, restartContainer } from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";

type Params = {
  params: { slug: string };
};

async function ensureWorkspace(project: { workspacePath: string }) {
  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);
  const ok = await fs.promises
    .stat(workspace)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!ok) {
    throw new Error("Workspace not found on disk");
  }
  return workspace;
}

export async function runDockerfileBuildJob(jobId: number) {
  const job = await prisma.buildJob.findUnique({
    where: { id: jobId },
    include: { project: true }
  });
  if (!job || !job.project) return;
  const project = job.project;

  let logText = "";

  try {
    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        error: null,
        log: null
      }
    });

    const workspace = await ensureWorkspace(project);

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

    const imageTag =
      project.dockerImageName || `ksr-bot-img-${project.slug}`;

    logText = await buildImageWithLogs(
      workspace,
      dockerfileName,
      imageTag,
      !!job.noCache
    );

    await prisma.project.update({
      where: { id: project.id },
      data: {
        dockerImageName: imageTag
      } as any
    });

    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        log: logText,
        imageTag
      }
    });
    if (job.autoRestart) {
      const containerName =
        project.dockerContainerName || `ksr-bot-${project.slug}`;
      try {
        await restartContainer(containerName);
      } catch {
        // ignore
      }
    }
  } catch (e: any) {
    const msg = e?.message || "Dockerfile build failed";
    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: msg,
        log: logText || null
      }
    });
  }
}

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const noCacheQuery =
    url.searchParams.get("rebuild") === "1" ||
    url.searchParams.get("nocache") === "1";

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runnerMode = (project as any).runnerMode || "DOCKERFILE";
  if (runnerMode === "TEMPLATE") {
    return NextResponse.json(
      { error: "Dockerfile build is not available for Template mode" },
      { status: 400 }
    );
  }

  const docker = await getDockerInfo();
  if (!docker.connected) {
    return NextResponse.json(
      { error: "Docker is not reachable", docker },
      { status: 503 }
    );
  }

  const job = await prisma.buildJob.create({
    data: {
      projectId: project.id,
      kind: "DOCKERFILE_BUILD",
      status: "QUEUED",
      noCache: !!noCacheQuery
    }
  });

  // Fire-and-forget
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runDockerfileBuildJob(job.id);

  return NextResponse.json({ ok: true, jobId: job.id });
}

