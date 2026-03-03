import { headers } from "next/headers";

type BucketKey = "auth" | "upload";

const buckets: Record<
  BucketKey,
  {
    map: Map<
      string,
      { count: number; last: number; lockedUntil?: number }
    >;
    windowMs: number;
    max: number;
    lockMs: number;
  }
> = {
  auth: {
    map: new Map(),
    windowMs: 5 * 60 * 1000,
    max: 10,
    lockMs: 15 * 60 * 1000
  },
  upload: {
    map: new Map(),
    windowMs: 5 * 60 * 1000,
    max: 30,
    lockMs: 10 * 60 * 1000
  }
};

export function applyRateLimit(bucket: BucketKey) {
  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for") ??
    hdrs.get("x-real-ip") ??
    "unknown";

  const cfg = buckets[bucket];
  const now = Date.now();
  const entry = cfg.map.get(ip);

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    throw new Error("Rate limit exceeded. Try again later.");
  }

  if (!entry || now - entry.last > cfg.windowMs) {
    cfg.map.set(ip, { count: 1, last: now });
    return;
  }

  entry.count += 1;
  entry.last = now;

  if (entry.count > cfg.max) {
    entry.lockedUntil = now + cfg.lockMs;
    throw new Error("Rate limit exceeded. Try again later.");
  }
}

