import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveProjectPath } from "@/lib/paths";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { verifyCsrfToken } from "@/lib/auth";

type Params = {
  params: { slug: string };
};

const writeSchema = z.object({
  path: z.string(),
  content: z.string()
});

const renameSchema = z.object({
  path: z.string(),
  newPath: z.string()
});

export async function GET(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const relPath = url.searchParams.get("path");
  if (!relPath) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const fullPath = resolveProjectPath(project.slug, relPath);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) {
      return NextResponse.json(
        { error: "Not a file" },
        { status: 400 }
      );
    }
    const content = await fs.promises.readFile(fullPath, "utf8");
    return NextResponse.json({ path: relPath, content });
  } catch (e) {
    console.error("Read file error", e);
    return NextResponse.json(
      { error: "Unable to read file" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: Params) {
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
    const json = await req.json();
    const parsed = writeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { path: relPath, content } = parsed.data;
    const fullPath = resolveProjectPath(project.slug, relPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content, "utf8");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Write file error", e);
    return NextResponse.json(
      { error: "Unable to write file" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
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
    const json = await req.json();
    const parsed = renameSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { path: relPath, newPath: newRelPath } = parsed.data;
    const fullPath = resolveProjectPath(project.slug, relPath);
    const newFullPath = resolveProjectPath(project.slug, newRelPath);
    await fs.promises.rename(fullPath, newFullPath);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Rename error", e);
    return NextResponse.json(
      { error: "Unable to rename" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const relPath = url.searchParams.get("path");
  if (!relPath) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const fullPath = resolveProjectPath(project.slug, relPath);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(fullPath);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete file error", e);
    return NextResponse.json(
      { error: "Unable to delete" },
      { status: 500 }
    );
  }
}

