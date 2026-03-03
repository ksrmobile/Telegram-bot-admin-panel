import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { verifyCsrfToken } from "@/lib/auth";
import { stopAndRemoveContainer, removeImage } from "@/lib/docker";
import { logAudit } from "@/lib/audit";

type Params = {
  params: { slug: string };
};

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function DELETE(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const containerName =
      project.dockerContainerName || `ksr-bot-${project.slug}`;
    const imageName =
      project.dockerImageName || `ksr-bot-img-${project.slug}`;

    // Best-effort cleanup of Docker resources.
    await stopAndRemoveContainer(containerName);
    await removeImage(imageName);

    // Remove workspace directory from disk (best-effort).
    if (project.workspacePath) {
      const workspace = path.isAbsolute(project.workspacePath)
        ? project.workspacePath
        : path.resolve(process.cwd(), project.workspacePath);
      try {
        await fs.promises.rm(workspace, { recursive: true, force: true });
      } catch {
        // ignore filesystem cleanup failures
      }
    }

    await prisma.project.delete({ where: { id: project.id } });
    await logAudit("project_deleted", project.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete project error", e);
    return NextResponse.json(
      { error: "Unable to delete project" },
      { status: 500 }
    );
  }
}

