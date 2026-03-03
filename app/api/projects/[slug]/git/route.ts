import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "../../../../../lib/prisma";
import { getGitInfo, gitPull } from "../../../../../lib/git";
import { getDockerInfo } from "../../../../../lib/docker";
import { verifyCsrfToken } from "../../../../../lib/auth";
import { logAudit } from "../../../../../lib/audit";
import { runTemplateBuildJob } from "../template-build/route";
import { runDockerfileBuildJob } from "../dockerfile-build/route";

type Params = {
  params: { slug: string };
};

function resolveWorkspace(workspacePath: string) {
  return path.isAbsolute(workspacePath)
    ? workspacePath
    : path.resolve(process.cwd(), workspacePath);
}

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workspace = resolveWorkspace(project.workspacePath);
  const info = await getGitInfo(workspace);

  return NextResponse.json({
    isRepo: info.isRepo,
    branch: info.branch,
    remoteUrl: info.remoteUrl,
    lastCommitHash: info.lastCommitHash,
    lastCommitMessage: info.lastCommitMessage,
    lastCommitAt: info.lastCommitAt
  });
}

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "pull";

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workspace = resolveWorkspace(project.workspacePath);

  const pullResult = await gitPull(workspace);
  if (!pullResult.ok) {
    await logAudit("git_pull_failed", project.id);
    return NextResponse.json(
      { error: pullResult.error || "git pull failed" },
      { status: 500 }
    );
  }

  await logAudit("git_pull", project.id);

  // For "pull" only, stop after pulling.
  if (action === "pull") {
    return NextResponse.json({ ok: true });
  }

  const runnerMode = (project as any).runnerMode || "DOCKERFILE";

  const docker = await getDockerInfo();
  if (!docker.connected) {
    return NextResponse.json(
      { error: "Docker is not reachable", docker },
      { status: 503 }
    );
  }

  if (action === "pull_rebuild" || action === "pull_rebuild_restart") {
    // Queue appropriate build job
    const kind =
      runnerMode === "TEMPLATE" ? "TEMPLATE_BUILD" : "DOCKERFILE_BUILD";

    const job = await prisma.buildJob.create({
      data: {
        projectId: project.id,
        kind,
        status: "QUEUED",
        noCache: false,
        autoRestart: action === "pull_rebuild_restart"
      }
    });

    if (kind === "TEMPLATE_BUILD") {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runTemplateBuildJob(job.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runDockerfileBuildJob(job.id);
    }

    await logAudit(
      action === "pull_rebuild_restart"
        ? "git_pull_rebuild_restart"
        : "git_pull_rebuild",
      project.id
    );

    return NextResponse.json({ ok: true, jobId: job.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

