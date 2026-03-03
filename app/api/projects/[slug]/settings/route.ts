import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { verifyCsrfToken } from "../../../../../lib/auth";
import { z } from "zod";

type Params = {
  params: { slug: string };
};

const bodySchema = z.object({
  cpuLimit: z.number().min(0).max(8).nullable().optional(),
  memoryLimitMb: z.number().min(0).max(65536).nullable().optional()
});

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
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.cpuLimit !== undefined) {
      data.cpuLimit = parsed.data.cpuLimit;
    }
    if (parsed.data.memoryLimitMb !== undefined) {
      data.memoryLimitMb = parsed.data.memoryLimitMb;
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Settings update error", e);
    return NextResponse.json(
      { error: "Unable to update settings" },
      { status: 500 }
    );
  }
}

