import type { MiddlewareHandler } from "hono";

export function contentLengthLimitMiddleware(
  maxBytes: number,
): MiddlewareHandler {
  return async (c, next) => {
    const contentLength = c.req.header("content-length");
    if (!contentLength) {
      return c.json({ error: "Content-Length required" }, 411);
    }
    const parsed = Number(contentLength);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > maxBytes) {
      return c.json({ error: "Payload too large" }, 413);
    }
    await next();
  };
}
