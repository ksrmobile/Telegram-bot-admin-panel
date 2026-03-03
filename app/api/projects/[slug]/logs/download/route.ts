import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getRecentLogs } from "@/lib/docker";

type Params = {
  params: { slug: string };
};

export async function GET(req: Request, { params }: Params) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const linesParam = url.searchParams.get("lines");
  const stripAnsiParam = url.searchParams.get("stripAnsi");

  const tail = Math.min(
    Math.max(Number.parseInt(linesParam || "5000", 10) || 5000, 100),
    50_000
  );
  const stripAnsi = stripAnsiParam !== "0";

  const containerName =
    project.dockerContainerName || `ksr-bot-${project.slug}`;

  const lines = await getRecentLogs(containerName, tail, {
    stripAnsi
  });

  const text = lines.join("\n");

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const safeSlug = project.slug.replace(/[^a-zA-Z0-9-_]+/g, "_");
  const filename = `${safeSlug}-logs-${y}${m}${d}-${hh}${mm}${ss}.log`;

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

