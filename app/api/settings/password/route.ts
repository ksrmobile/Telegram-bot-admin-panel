import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { requireSession, verifyCsrfToken } from "../../../lib/auth";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});

export async function POST(req: Request) {
  if (!verifyCsrfToken(req.headers)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.userId }
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash }
  });

  return NextResponse.json({ ok: true });
}
