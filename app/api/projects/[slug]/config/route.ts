import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { resolveProjectPath } from "@/lib/paths";
import { maskSecret } from "@/lib/secrets";
import { verifyCsrfToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

type Params = {
  params: { slug: string };
};

const updateSchema = z.object({
  env: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.string()
      })
    )
    .optional()
});

async function readEnvFile(envPath: string) {
  try {
    const raw = await fs.promises.readFile(envPath, "utf8");
    const pairs: { key: string; value: string; masked: string }[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      pairs.push({ key, value, masked: maskSecret(key, value) });
    }
    return pairs;
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const envPath =
    project.envFilePath ||
    resolveProjectPath(project.slug, ".env");
  const envPairs = await readEnvFile(envPath);

  return NextResponse.json({
    envPath,
    env: envPairs
  });
}

export async function POST(req: Request, { params }: Params) {
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
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const envPath =
      project.envFilePath ||
      resolveProjectPath(project.slug, ".env");

    if (parsed.data.env) {
      const lines = parsed.data.env.map(
        (e) => `${e.key}=${e.value.replace(/\n/g, "\\n")}`
      );
      await fs.promises.mkdir(path.dirname(envPath), {
        recursive: true
      });
      await fs.promises.writeFile(envPath, lines.join("\n") + "\n", "utf8");
    }

    await prisma.project.update({
      where: { id: project.id },
      data: {
        envFilePath: envPath
      }
    });

    await logAudit("config_saved", project.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Config update error", e);
    return NextResponse.json(
      { error: "Unable to update config" },
      { status: 500 }
    );
  }
}

