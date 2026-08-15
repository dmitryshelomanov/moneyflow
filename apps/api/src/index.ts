import { serve } from "@hono/node-server";
import { migrate } from "./db/migrate.js";
import { env } from "./env.js";
import { log } from "./log.js";
import { createApp } from "./server/createApp.js";
import {
  createShutdownHandler,
  installSignalHandlers,
  startBotSafely,
} from "./server/lifecycle.js";

try {
  migrate();
  log.info("boot", "migrations applied", { db: env.DATABASE_PATH });
} catch (err) {
  log.error(
    "boot",
    "startup failed during migration",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}

const app = createApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log.info("boot", `API listening on http://localhost:${info.port}`);
  log.info("boot", `App path: /k/${env.ACCESS_KEY}/`);
  log.debug("boot", "env", {
    nodeEnv: env.NODE_ENV,
    webOrigin: env.WEB_ORIGIN,
    hasRouterAi: Boolean(env.ROUTERAI_API_KEY),
    hasTelegram: Boolean(env.TELEGRAM_BOT_TOKEN),
    model: env.ROUTERAI_MODEL,
  });
});

const botPromise = startBotSafely();
const shutdown = createShutdownHandler({ server, botPromise });
installSignalHandlers(shutdown);
