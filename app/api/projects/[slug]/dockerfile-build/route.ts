import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDockerInfo } from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";
import { runDockerfileBuildJob } from "@/lib/build-jobs";

type Params = {
  params: { slug: string };
};

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

