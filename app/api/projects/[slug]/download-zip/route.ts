import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "../../../../../lib/prisma";
import { resolveProjectPath } from "../../../../../lib/paths";
import { createZipFromDirectory } from "../../../../../lib/zip";

type Params = {
  params: { slug: string };
};

export async function GET(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const relPath = url.searchParams.get("path") || ".";

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const dir = resolveProjectPath(project.slug, relPath);
    const tmpDir = path.join("/tmp", "ksr-download");
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, `${project.slug}-${Date.now()}.zip`);

    await createZipFromDirectory(dir, zipPath);

    const data = await fs.promises.readFile(zipPath);
    await fs.promises.unlink(zipPath).catch(() => {});

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.slug}.zip"`
      }
    });
  } catch (e) {
    console.error("Download zip error", e);
    return NextResponse.json(
      { error: "Unable to create zip" },
      { status: 500 }
    );
  }
}

