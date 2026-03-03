import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildImageWithLogs, getDockerInfo, restartContainer } from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";
import { getBuildContextRoot } from "@/lib/paths";

type Params = {
  params: { slug: string };
};

const bodySchema = z.object({
  noCache: z.boolean().optional()
});

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

    const startCmd = (project.startCommand || "npm start").replace(
      /"/g,
      '\\"'
    );

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

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const noCacheQuery =
    url.searchParams.get("rebuild") === "1" ||
    url.searchParams.get("nocache") === "1";

  let noCache = noCacheQuery;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(json);
      if (parsed.success && parsed.data.noCache != null) {
        noCache = parsed.data.noCache;
      }
    }
  } catch {
    // ignore body parse errors – fall back to query flags
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runnerMode = (project as any).runnerMode || "DOCKERFILE";
  if (runnerMode !== "TEMPLATE") {
    return NextResponse.json(
      { error: "Template mode not enabled for this project" },
      { status: 400 }
    );
  }

  const docker = await getDockerInfo();
  if (!docker.connected) {
    return NextResponse.json(
      {
        error: "Docker is not reachable",
        docker
      },
      { status: 503 }
    );
  }

  const job = await prisma.buildJob.create({
    data: {
      projectId: project.id,
      kind: "TEMPLATE_BUILD",
      status: "QUEUED",
      noCache: !!noCache
    }
  });

  // Fire-and-forget background job
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  runTemplateBuildJob(job.id);

  return NextResponse.json({ ok: true, jobId: job.id });
}

