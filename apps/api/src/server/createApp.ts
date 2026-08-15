import { Hono } from "hono";
import { api } from "../routes/api.js";
import { accessKeyGuardMiddleware } from "./middleware/access-key.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { registerProductionStaticRoutes } from "./static.js";

export function createApp(): Hono {
  const app = new Hono();
  app.use("*", corsMiddleware);
  app.use("*", requestLoggerMiddleware);

  app.get("/health", (c) => c.json({ ok: true }));

  const guarded = new Hono();
  guarded.use("*", accessKeyGuardMiddleware);
  guarded.route("/api", api);
  registerProductionStaticRoutes(guarded);

  app.route("/k/:accessKey", guarded);
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}
