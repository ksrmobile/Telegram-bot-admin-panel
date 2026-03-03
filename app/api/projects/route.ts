import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import { getProjectRoot } from "../../../lib/paths";
import fs from "fs";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  runtimeType: z.enum(["NODE", "PYTHON", "DOCKERFILE"]),
  startCommand: z.string().min(1).max(256),
  runnerMode: z.enum(["DOCKERFILE", "TEMPLATE"]).optional(),
  templateRuntime: z.enum(["NODE", "PYTHON", "CUSTOM"]).optional(),
  templateWorkdir: z.string().min(1).max(256).optional(),
  templateInstall: z.string().min(1).max(64).optional(),
  templateAptPackages: z
    .string()
    .max(512)
    .regex(/^[a-z0-9.+\-\s]*$/i, "Only a–z, 0–9, space, ., +, - allowed")
    .optional(),
  templateBaseImage: z
    .string()
    .max(128)
    .regex(/^[a-z0-9./:+\-]+$/i, "Invalid image name")
    .optional(),
  templateExposePort: z.number().int().min(1).max(65535).optional(),
  bindMountWorkspace: z.boolean().optional()
});

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const {
      name,
      runtimeType,
      startCommand,
      slug: customSlug,
      runnerMode: bodyRunnerMode,
      templateRuntime,
      templateWorkdir,
      templateInstall,
      templateAptPackages,
      templateBaseImage,
      templateExposePort,
      bindMountWorkspace
    } = parsed.data;
    const slug = customSlug && /^[a-z0-9-]+$/.test(customSlug)
      ? customSlug.replace(/^-+|-+$/g, "") || undefined
      : undefined;
    const finalSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const workspacePath = getProjectRoot(finalSlug);
    await fs.promises.mkdir(workspacePath, { recursive: true });

    const project = await prisma.project.create({
      data: {
        name,
        slug: finalSlug,
        runtimeType,
        startCommand,
        workspacePath,
        runnerMode: bodyRunnerMode || "DOCKERFILE",
        templateRuntime: templateRuntime || null,
        templateWorkdir: templateWorkdir || null,
        templateInstall: templateInstall || null,
        templateAptPackages: (templateAptPackages || "").trim() || null,
        templateBaseImage: templateBaseImage || null,
        templateExposePort: templateExposePort ?? null,
        bindMountWorkspace: bindMountWorkspace ?? false
      } as any
    });

    await prisma.auditLog.create({
      data: { action: "project_created", projectId: project.id }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    console.error("Create project error", e);
    return NextResponse.json(
      { error: "Unable to create project" },
      { status: 500 }
    );
  }
}

