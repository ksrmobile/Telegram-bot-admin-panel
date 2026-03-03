import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDockerInfo } from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";
import { runTemplateBuildJob } from "@/lib/build-jobs";

type Params = {
  params: { slug: string };
};

const bodySchema = z.object({
  noCache: z.boolean().optional()
});

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

