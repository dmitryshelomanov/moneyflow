import type { MiddlewareHandler } from "hono";
import { env } from "../../env.js";
import { log } from "../../log.js";

export const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
  if (env.NODE_ENV !== "development") {
    await next();
    return;
  }

  const startedAt = Date.now();
  await next();
  log.debug("http", `${c.req.method} ${c.req.path} → ${c.res.status}`, {
    ms: Date.now() - startedAt,
  });
};
