import type { MiddlewareHandler } from "hono";
import { env } from "../../env.js";
import { log } from "../../log.js";

export const accessKeyGuardMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.param("accessKey") !== env.ACCESS_KEY) {
    log.warn("auth", "invalid access key", { path: c.req.path });
    return c.notFound();
  }
  await next();
};
