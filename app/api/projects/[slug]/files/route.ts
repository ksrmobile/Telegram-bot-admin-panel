import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveProjectPath } from "../../../../../lib/paths";
import { prisma } from "../../../../../lib/prisma";
import { verifyCsrfToken } from "../../../../../lib/auth";

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
    const fullPath = resolveProjectPath(project.slug, relPath);
    const dirents = await fs.promises.readdir(fullPath, {
      withFileTypes: true
    });

    const items = await Promise.all(
      dirents.map(async (d) => {
        const itemPath = path.join(fullPath, d.name);
        const stat = await fs.promises.stat(itemPath);
        return {
          name: d.name,
          isDir: d.isDirectory(),
          size: stat.size
        };
      })
    );

    return NextResponse.json({ path: relPath, items });
  } catch (e) {
    console.error("List files error", e);
    return NextResponse.json(
      { error: "Unable to list files" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
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
    const dirPath = resolveProjectPath(project.slug, relPath);
    const dirents = await fs.promises.readdir(dirPath, {
      withFileTypes: true
    });

    await Promise.all(
      dirents.map(async (d) => {
        const target = path.join(dirPath, d.name);
        if (d.isDirectory()) {
          await fs.promises.rm(target, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(target).catch(() => {});
        }
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Clear directory error", e);
    return NextResponse.json(
      { error: "Unable to delete directory contents" },
      { status: 500 }
    );
  }
}

