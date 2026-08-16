import type { MiddlewareHandler } from "hono";

type RateLimitStoreEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  statusCode?: 429;
  message?: string;
  resolveKey?: (c: Parameters<MiddlewareHandler>[0]) => string;
};

const store = new Map<string, RateLimitStoreEntry>();

function clientIpFromHeaders(c: Parameters<MiddlewareHandler>[0]): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function defaultKey(c: Parameters<MiddlewareHandler>[0]) {
  return `${clientIpFromHeaders(c)}:${c.req.path}`;
}

function cleanupExpiredEntries(now: number) {
  if (store.size < 10_000) return;
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) store.delete(key);
  }
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const keyBody = options.resolveKey?.(c) ?? defaultKey(c);
    const key = `${options.keyPrefix}:${keyBody}`;
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    existing.count += 1;
    if (existing.count > options.maxRequests) {
      c.header(
        "Retry-After",
        String(Math.ceil((existing.resetAt - now) / 1000)),
      );
      return c.json(
        { error: options.message ?? "Too many requests" },
        options.statusCode ?? 429,
      );
    }

    await next();
  };
}

export const authRateLimitMiddleware = createRateLimitMiddleware({
  keyPrefix: "auth",
  windowMs: 60_000,
  maxRequests: 10,
  message: "Too many auth requests",
});

export const aiRateLimitMiddleware = createRateLimitMiddleware({
  keyPrefix: "ai",
  windowMs: 60 * 60 * 1000,
  maxRequests: 40,
  message: "Too many AI requests",
  resolveKey: (c) => {
    const telegramId = c.get("user")?.telegramId;
    if (typeof telegramId === "number") return `tg:${telegramId}`;
    return defaultKey(c);
  },
});
