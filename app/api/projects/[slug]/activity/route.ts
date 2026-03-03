import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { slug: string } };

export async function GET(_req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return NextResponse.json(logs);
}
