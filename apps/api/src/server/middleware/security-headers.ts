import type { Context, MiddlewareHandler } from "hono";

export function applySecurityHeaders(c: Context) {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
  c.header("Content-Security-Policy", "frame-ancestors 'none'");
}

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  applySecurityHeaders(c);
};
