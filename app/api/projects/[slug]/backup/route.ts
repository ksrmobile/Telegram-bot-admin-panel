import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "../../../../../lib/prisma";
import { resolveProjectPath } from "../../../../../lib/paths";
import { createZipFromDirectory, safeExtractZip } from "../../../../../lib/zip";
import { verifyCsrfToken } from "../../../../../lib/auth";
import { applyRateLimit } from "../../../../../lib/rate-limit";
import { logAudit } from "../../../../../lib/audit";

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

  try {
    const dir = resolveProjectPath(project.slug, ".");
    const tmpDir = path.join("/tmp", "ksr-backup");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, `${project.slug}-backup-${Date.now()}.zip`);

    await createZipFromDirectory(dir, zipPath);

    const data = await fs.promises.readFile(zipPath);
    await fs.promises.unlink(zipPath).catch(() => {});

    await logAudit("backup_exported", project.id);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.slug}-backup.zip"`
      }
    });
  } catch (e) {
    console.error("Backup error", e);
    return NextResponse.json(
      { error: "Unable to create backup" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  try {
    applyRateLimit("upload");
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Rate limited" },
      { status: 429 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tmpDir = path.join("/tmp", "ksr-restore");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-${file.name}`);
    await fs.promises.writeFile(tmpPath, buffer);

    const targetDir = resolveProjectPath(project.slug, ".");
    await safeExtractZip(tmpPath, targetDir);
    await fs.promises.unlink(tmpPath).catch(() => {});

    await logAudit("backup_restored", project.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Restore error", e);
    return NextResponse.json(
      { error: "Unable to restore backup" },
      { status: 500 }
    );
  }
}

