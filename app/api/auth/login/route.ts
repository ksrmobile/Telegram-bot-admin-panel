import { NextResponse } from "next/server";
import {
  authenticate,
  SESSION_COOKIE,
  CSRF_COOKIE,
  getSessionCookieOptions,
  getCsrfCookieOptions
} from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string(),
  password: z.string()
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const result = await authenticate(parsed.data);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, result.sessionToken!, getSessionCookieOptions());
    res.cookies.set(CSRF_COOKIE, result.csrfToken!, getCsrfCookieOptions());
    return res;
  } catch (e) {
    console.error("Login error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

