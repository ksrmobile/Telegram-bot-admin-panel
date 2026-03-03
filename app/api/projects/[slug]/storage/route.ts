import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  getProjectStorage,
  deleteProjectBuildContext,
  cleanupTmpBackupsForProject
} from "@/lib/storage";
import { verifyCsrfToken } from "@/lib/auth";
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

  const storage = await getProjectStorage(project.id, project.workspacePath);

  return NextResponse.json({
    workspaceBytes: storage.workspaceBytes,
    buildBytes: storage.buildBytes
  });
}

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "cleanup-build-contexts") {
    await deleteProjectBuildContext(project.id);
    await logAudit("storage_cleanup_build_contexts", project.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "cleanup-backups") {
    await cleanupTmpBackupsForProject(project.slug, 3);
    await logAudit("storage_cleanup_backups", project.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

