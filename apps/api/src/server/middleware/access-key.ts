import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { env } from "../../env.js";
import { log } from "../../log.js";
import { connectionAddress, consumeRateLimit } from "./rate-limit.js";

const ACCESS_KEY_WINDOW_MS = 60_000;
const ACCESS_KEY_MAX_FAILURES = 20;

function accessKeysEqual(
  provided: string | undefined,
  expected: string,
): boolean {
  const actual = createHash("sha256")
    .update(provided ?? "", "utf8")
    .digest();
  const wanted = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actual, wanted);
}

export const accessKeyGuardMiddleware: MiddlewareHandler = async (c, next) => {
  if (accessKeysEqual(c.req.param("accessKey"), env.ACCESS_KEY)) {
    await next();
    return;
  }

  log.warn("auth", "invalid access key");
  const decision = consumeRateLimit(
    `access-key:${connectionAddress(c)}`,
    ACCESS_KEY_WINDOW_MS,
    ACCESS_KEY_MAX_FAILURES,
  );
  if (!decision.allowed) {
    c.header("Retry-After", String(decision.retryAfterSeconds));
    return c.json({ error: "Too many requests" }, 429);
  }
  return c.notFound();
};
