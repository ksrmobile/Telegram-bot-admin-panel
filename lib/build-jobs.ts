import path from "path";
import fs from "fs";
import { prisma } from "./prisma";
import { buildImageWithLogs, restartContainer } from "./docker";
import { getBuildContextRoot } from "./paths";

function sanitizeAptPackages(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/[^a-z0-9.+\-\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureCleanDir(dir: string) {
  await fs.promises.rm(dir, { recursive: true, force: true } as any);
  await fs.promises.mkdir(dir, { recursive: true });
}

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

export async function runTemplateBuildJob(jobId: number) {
  const job = await prisma.buildJob.findUnique({
    where: { id: jobId },
    include: { project: true }
  });
  if (!job || !job.project) return;
  const project = job.project as any;

  const workspace = path.isAbsolute(project.workspacePath)
    ? project.workspacePath
    : path.resolve(process.cwd(), project.workspacePath);

  const statsOk = await fs.promises
    .stat(workspace)
    .then((st) => st.isDirectory())
    .catch(() => false);

  if (!statsOk) {
    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: "Workspace not found on disk",
        finishedAt: new Date()
      }
    });
    return;
  }

  const buildRoot = getBuildContextRoot(project.id);
  const absBuildRoot = path.isAbsolute(buildRoot)
    ? buildRoot
    : path.resolve(process.cwd(), buildRoot);

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

    await ensureCleanDir(absBuildRoot);

    const srcDir = path.join(absBuildRoot, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });
    if ((fs.promises as any).cp) {
      await (fs.promises as any).cp(workspace, srcDir, {
        recursive: true,
        filter: (src: string) => {
          const rel = path.relative(workspace, src);
          if (!rel) return true;
          if (rel.startsWith(".git")) return false;
          if (rel.startsWith("node_modules")) return false;
          if (rel.includes(path.sep + ".next" + path.sep)) return false;
          if (rel.startsWith(".docker")) return false;
          return true;
        }
      });
    } else {
      throw new Error(
        "Current Node.js runtime does not support fs.promises.cp, which is required for template builds."
      );
    }

    const dockerfilePath = path.join(absBuildRoot, "Dockerfile");
    const dockerignorePath = path.join(absBuildRoot, ".dockerignore");

    const aptPkgs = sanitizeAptPackages(
      project.templateAptPackages as string | null | undefined
    );

    const runtime =
      (project.templateRuntime as string | null) ||
      project.runtimeType ||
      "NODE";

    const baseImage =
      project.templateBaseImage ||
      (runtime === "PYTHON"
        ? "python:3.11-slim"
        : runtime === "NODE"
        ? "node:20-slim"
        : "ubuntu:22.04");

    const workdir = project.templateWorkdir || "/app";

    let startCmdRaw: string | null | undefined =
      (project.startCommand as string | null | undefined) || null;
    if (!startCmdRaw || !startCmdRaw.trim()) {
      if (runtime === "PYTHON") {
        startCmdRaw = "python3 main.py";
      } else {
        startCmdRaw = "npm start";
      }
    }
    // Use python3 in container so it works on images that only have python3
    if (runtime === "PYTHON" && startCmdRaw.startsWith("python ")) {
      startCmdRaw = "python3 " + startCmdRaw.slice(7);
    }
    const startCmd = startCmdRaw.replace(/"/g, '\\"');

    const hasRequirements = fs.existsSync(
      path.join(workspace, "requirements.txt")
    );
    const hasPyproject = fs.existsSync(
      path.join(workspace, "pyproject.toml")
    );
    const hasPackageJson = fs.existsSync(
      path.join(workspace, "package.json")
    );
    const hasPackageLock = fs.existsSync(
      path.join(workspace, "package-lock.json")
    );

    let installLines = "";
    if (runtime === "PYTHON") {
      if (hasRequirements) {
        installLines =
          "RUN pip install --no-cache-dir -r requirements.txt || true\n";
      } else if (hasPyproject) {
        installLines = "RUN pip install --no-cache-dir . || true\n";
      }
    } else if (runtime === "NODE") {
      if (hasPackageJson) {
        if (hasPackageLock) {
          installLines =
            "RUN npm ci --omit=dev || npm install --omit=dev || true\n";
        } else {
          installLines = "RUN npm install --omit=dev || true\n";
        }
      }
    }

    const aptLines = aptPkgs
      ? `RUN apt-get update && apt-get install -y ${aptPkgs} && rm -rf /var/lib/apt/lists/*\n`
      : "";

    const dockerfile = `FROM ${baseImage}
${aptLines}WORKDIR ${workdir}
COPY src/ .
${installLines}CMD ["sh", "-c", "${startCmd}"]
`;

    await fs.promises.writeFile(dockerfilePath, dockerfile, "utf8");

    const dockerignore = `node_modules
.git
.next
Dockerfile
Dockerfile.ksr
*.log
tmp
`;
    await fs.promises.writeFile(dockerignorePath, dockerignore, "utf8");

    const imageTag = `ksr-tg-panel/${project.slug}:latest`;

    logText = await buildImageWithLogs(
      absBuildRoot,
      "Dockerfile",
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
        // ignore restart failure; user can restart manually
      }
    }
  } catch (e: any) {
    const message = e?.message || "Template build failed";
    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: message,
        log: logText || null
      }
    });
  }
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

