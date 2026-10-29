/**
 * Fixed-window-with-sliding-log rate limiter, in memory. Fine for a single
 * server instance; for multiple instances implement RateLimiter on Redis or
 * your platform's KV store and pass it to the route handlers.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, cost?: number): RateLimitResult;
}

export function createMemoryRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  return {
    check(key, cost = 1) {
      const t = now();
      if (t - lastSweep > windowMs * 5) {
        for (const [k, v] of hits) if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
        lastSweep = t;
      }
      const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
      if (recent.length + cost > limit) {
        const oldest = recent[0] ?? t;
        hits.set(key, recent);
        return { allowed: false, remaining: Math.max(0, limit - recent.length), retryAfterMs: Math.max(0, windowMs - (t - oldest)) };
      }
      for (let i = 0; i < cost; i++) recent.push(t);
      hits.set(key, recent);
      return { allowed: true, remaining: limit - recent.length, retryAfterMs: 0 };
    },
  };
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || "local";
}
