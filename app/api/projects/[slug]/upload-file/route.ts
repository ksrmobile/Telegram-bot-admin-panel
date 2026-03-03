import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "../../../../../lib/prisma";
import { resolveProjectPath } from "../../../../../lib/paths";
import { verifyCsrfToken } from "../../../../../lib/auth";
import { applyRateLimit } from "../../../../../lib/rate-limit";

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

    const targetDir = resolveProjectPath(project.slug, relPath);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, file.name);
    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Upload file error", e);
    return NextResponse.json(
      { error: "Unable to upload file" },
      { status: 500 }
    );
  }
}

