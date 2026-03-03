import { NextResponse } from "next/server";
import { getSystemStorageSummary } from "@/lib/storage";
import { pruneDanglingImages } from "@/lib/docker";
import { verifyCsrfToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const summary = await getSystemStorageSummary();
  return NextResponse.json(summary);
}

export async function POST(req: Request) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "prune-images") {
    const result = await pruneDanglingImages();
    await logAudit("storage_prune_images", null);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

