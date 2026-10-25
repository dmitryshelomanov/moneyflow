import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";

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

type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const store = new Map<string, RateLimitStoreEntry>();
const MAX_RATE_LIMIT_KEYS = 5_000;

/** Clears in-memory counters — for tests only. */
export function resetRateLimitStore() {
  store.clear();
}

export function connectionAddress(c: Context): string {
  try {
    const address = getConnInfo(c).remote.address?.trim();
    if (address) return address;
  } catch {
    // app.request() in tests has no socket. Do not trust X-Forwarded-For.
  }

  return "unknown";
}

function cleanupExpiredEntries(now: number) {
  if (store.size < 1_000) return;
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) store.delete(key);
  }
}

export function consumeRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): RateLimitDecision {
  const now = Date.now();
  cleanupExpiredEntries(now);
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    if (!existing && store.size >= MAX_RATE_LIMIT_KEYS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );
  if (existing.count > maxRequests) {
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function defaultKey(c: Parameters<MiddlewareHandler>[0]) {
  return `${connectionAddress(c)}:${c.req.path}`;
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  return async (c, next) => {
    const keyBody = options.resolveKey?.(c) ?? defaultKey(c);
    const decision = consumeRateLimit(
      `${options.keyPrefix}:${keyBody}`,
      options.windowMs,
      options.maxRequests,
    );
    if (!decision.allowed) {
      c.header("Retry-After", String(decision.retryAfterSeconds));
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
