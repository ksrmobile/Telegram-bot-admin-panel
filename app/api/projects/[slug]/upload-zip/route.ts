import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { resolveProjectPath } from "@/lib/paths";
import { safeExtractZip } from "@/lib/zip";
import { verifyCsrfToken } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

type Params = {
  params: { slug: string };
};

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

  const url = new URL(req.url);
  const relPath = url.searchParams.get("path") || ".";

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

    const tmpDir = path.join("/tmp", "ksr-upload");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-${file.name}`);
    await fs.promises.writeFile(tmpPath, buffer);

    const targetDir = resolveProjectPath(project.slug, relPath);
    await safeExtractZip(tmpPath, targetDir);
    await fs.promises.unlink(tmpPath).catch(() => {});

    await logAudit("upload_zip", project.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Upload zip error", e);
    return NextResponse.json(
      { error: "Unable to upload zip" },
      { status: 500 }
    );
  }
}

