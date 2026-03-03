import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { verifyCsrfToken } from "../../../../../lib/auth";

type Params = {
  params: { slug: string };
};

const bodySchema = z.object({
  runnerMode: z.enum(["DOCKERFILE", "TEMPLATE"]).optional(),
  templateRuntime: z.enum(["NODE", "PYTHON", "CUSTOM"]).optional(),
  templateWorkdir: z
    .string()
    .min(1)
    .max(256)
    .regex(/^\/[a-zA-Z0-9/_-]*$/, "Workdir must be an absolute path")
    .optional(),
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
  templateExposePort: z.number().int().min(1).max(65535).nullable().optional(),
  bindMountWorkspace: z.boolean().optional(),
  startCommand: z.string().min(1).max(256).optional()
});

export async function POST(req: Request, { params }: Params) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = parsed.data;
  const runnerMode = data.runnerMode || "TEMPLATE";

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      runnerMode,
      templateRuntime: data.templateRuntime ?? project.runtimeType,
      templateWorkdir: data.templateWorkdir || "/app",
      templateInstall: data.templateInstall || null,
      templateAptPackages: (data.templateAptPackages || "").trim() || null,
      templateBaseImage: data.templateBaseImage || null,
      templateExposePort:
        data.templateExposePort === undefined
          ? project.templateExposePort
          : data.templateExposePort,
      bindMountWorkspace:
        data.bindMountWorkspace ?? project.bindMountWorkspace ?? false,
      startCommand: data.startCommand || project.startCommand
    } as any
  });

  return NextResponse.json(updated);
}

