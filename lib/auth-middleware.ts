import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

/** Must match lib/auth.ts SESSION_COOKIE so middleware and auth stay in sync. */
const SESSION_COOKIE = "ksr_session";

export type SessionPayload = { userId: number; username: string };

/**
 * Read and verify session from the request cookies in Edge middleware.
 * Uses jose (Edge-compatible) instead of jsonwebtoken.
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    const sub = payload.sub;
    const username = payload.username;
    if (typeof sub !== "number" && typeof sub !== "string") return null;
    if (typeof username !== "string") return null;
    return {
      userId: typeof sub === "string" ? parseInt(sub, 10) : sub,
      username
    };
  } catch {
    return null;
  }
}
