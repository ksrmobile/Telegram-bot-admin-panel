import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: { slug: string };
};

type LikelyFix = {
  id: string;
  title: string;
  description: string;
  presetSuggestion?: string;
};

function computeDiagnostics(log: string | null | undefined): LikelyFix[] {
  if (!log) return [];
  const text = log;
  const lower = text.toLowerCase();
  const out: LikelyFix[] = [];

  if (
    /failed building wheel/i.test(text) ||
    /unable to execute 'gcc'/i.test(text) ||
    /command 'gcc' failed/i.test(text) ||
    /python\.h: no such file or directory/i.test(text)
  ) {
    out.push({
      id: "python_build_tools",
      title: "Missing build tools for Python wheels",
      description:
        "The build log shows native wheel compilation failures (gcc/Python.h). Use the Python + Build Tools preset so build-essential, gcc, python3-dev, libssl-dev, and libffi-dev are installed.",
      presetSuggestion: "python_build_tools"
    });
  }

  if (/ffmpeg.*not found/i.test(text) || /ffmpeg: command not found/i.test(text)) {
    out.push({
      id: "ffmpeg_missing",
      title: "FFmpeg binary not found in container",
      description:
        "The build or runtime log references ffmpeg but it is not installed. Use the Python/Node + FFmpeg preset so ffmpeg and common tools are available.",
      presetSuggestion: "python_ffmpeg"
    });
  }

  if (/could not open requirements\.txt/i.test(lower) || /requirements\.txt.*no such file/i.test(lower)) {
    out.push({
      id: "requirements_missing",
      title: "requirements.txt not found",
      description:
        "The Dockerfile tried to install dependencies from requirements.txt, but the file is missing. Ensure requirements.txt exists at the project root or adjust your install strategy.",
      presetSuggestion: undefined
    });
  }

  if (
    /command not found/i.test(text) &&
    (/\bpython\b/.test(text) || /\bpython3\b/.test(text) || /\bnode\b/.test(text))
  ) {
    out.push({
      id: "runtime_command_not_found",
      title: "Runtime binary not found (python/node)",
      description:
        "The container could not find the python/node binary. Double-check the selected runtime and base image in Template Mode, and ensure your start command matches the runtime.",
      presetSuggestion: undefined
    });
  }

  if (/permission denied/i.test(text) && (/copy/i.test(text) || /cp: /i.test(text))) {
    out.push({
      id: "permissions",
      title: "Permission issues while copying files",
      description:
        "The build encountered permission denied errors copying files. Ensure the project workspace is readable by the Docker daemon user and that no files are marked unreadable.",
      presetSuggestion: undefined
    });
  }

  return out;
}

async function reconcileStaleJobs(projectId: number) {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  await prisma.buildJob.updateMany({
    where: {
      projectId,
      status: {
        in: ["QUEUED", "RUNNING"]
      },
      updatedAt: {
        lt: cutoff
      }
    },
    data: {
      status: "FAILED",
      error:
        "Job did not complete (likely panel restart). Please start a new build."
    }
  });
}

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await reconcileStaleJobs(project.id);

  const jobs = await prisma.buildJob.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  const enriched = jobs.map((job) => {
    const log = job.log || "";
    const lastLines =
      log
        .split("\n")
        .slice(-150)
        .join("\n") || null;
    const diagnostics = computeDiagnostics(lastLines);
    return {
      id: job.id,
      status: job.status,
      kind: job.kind,
      noCache: job.noCache,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      lastLogTail: lastLines,
      diagnostics
    };
  });

  return NextResponse.json({ jobs: enriched });
}

