import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { NotATransactionError } from "../bot-messages.js";
import { sqlite } from "../db/client.js";
import { env } from "../env.js";
import { isAppError } from "../errors.js";
import { log } from "../log.js";
import { api } from "../routes/api.js";
import { accessKeyGuardMiddleware } from "./middleware/access-key.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { registerProductionStaticRoutes } from "./static.js";

function mapErrorToStatus(error: unknown): ContentfulStatusCode {
  if (isAppError(error) && error.status >= 400 && error.status < 600) {
    return error.status as ContentfulStatusCode;
  }
  if (error instanceof ZodError) return 400;
  if (
    error instanceof Error &&
    (error.message === "Invalid cursor" ||
      error.message === "Invalid cursor format")
  ) {
    return 400;
  }
  if (error instanceof NotATransactionError) return 400;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (code === "SQLITE_CONSTRAINT_FOREIGNKEY") return 400;
    if (code.startsWith("SQLITE_CONSTRAINT")) return 400;
  }
  return 500;
}

function mapErrorMessage(error: unknown, status: number): unknown {
  if (isAppError(error)) return error.message;
  if (error instanceof ZodError) return error.flatten();
  if (status >= 500 && env.NODE_ENV === "production") {
    return "Internal server error";
  }
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export function createApp(): Hono {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.use("*", requestLoggerMiddleware);
  app.onError((error, c) => {
    const status = mapErrorToStatus(error);
    const message = mapErrorMessage(error, status);
    log.error("http", "request failed", {
      method: c.req.method,
      path: c.req.path,
      status,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: message }, status);
  });

  app.get("/health", (c) => {
    try {
      sqlite.prepare("SELECT 1").get();
      return c.json({ ok: true, db: "ok" });
    } catch {
      return c.json({ ok: false, db: "error" }, 503);
    }
  });

  const guarded = new Hono();
  guarded.use("*", accessKeyGuardMiddleware);
  guarded.route("/api", api);
  registerProductionStaticRoutes(guarded);

  app.route("/k/:accessKey", guarded);
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}
