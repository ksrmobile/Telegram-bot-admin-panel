import "server-only";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { z } from "zod";
import crypto from "crypto";

export const SESSION_COOKIE = "ksr_session";
export const CSRF_COOKIE = "ksr_csrf";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/** Cookie options for local dev (http) and production (https). Use when setting cookies on NextResponse. */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE
  };
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE
  };
}

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(128)
});

type JwtPayload = {
  sub: number;
  username: string;
};

const rateLimitMap = new Map<
  string,
  { count: number; lastAttempt: number; lockedUntil?: number }
>();

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

export async function ensureAdminUser() {
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASS;

  if (!adminPass) {
    // We still allow running, but admin must be created manually later.
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { username: adminUser }
  });
  if (existing) return;

  const hash = await bcrypt.hash(adminPass, 12);
  await prisma.user.create({
    data: {
      username: adminUser,
      password: hash
    }
  });
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    throw new Error("Too many attempts. Try again later.");
  }

  if (!entry || now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, lastAttempt: now });
    return;
  }

  entry.count += 1;
  entry.lastAttempt = now;

  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
    throw new Error("Too many attempts. Try again later.");
  }
}

export async function authenticate(
  body: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const { username, password } = parsed.data;

  const ip =
    headers().get("x-forwarded-for") ??
    headers().get("x-real-ip") ??
    "unknown";

  try {
    checkRateLimit(ip);
  } catch (e: any) {
    return { success: false, error: e.message || "Rate limited" };
  }

  await ensureAdminUser();

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { success: false, error: "Invalid credentials" };
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return { success: false, error: "Invalid credentials" };
  }

  const payload: JwtPayload = { sub: user.id, username: user.username };
  const token = jwt.sign(payload, getSessionSecret(), {
    expiresIn: "7d"
  });

  const csrfToken = crypto.randomBytes(32).toString("hex");

  return {
    success: true,
    sessionToken: token,
    csrfToken
  };
}

export async function getSession(): Promise<{
  userId: number;
  username: string;
} | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getSessionSecret()) as JwtPayload;
    return { userId: decoded.sub, username: decoded.username };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCsrfToken() {
  const cookieStore = cookies();
  return cookieStore.get(CSRF_COOKIE)?.value;
}

export function verifyCsrfToken(reqHeaders: Headers) {
  const submitted = reqHeaders.get("x-csrf-token");
  if (!submitted) return false;
  const csrf = cookies().get(CSRF_COOKIE)?.value;
  return csrf && submitted === csrf;
}

