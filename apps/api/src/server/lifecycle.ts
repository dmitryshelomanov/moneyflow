import type { ServerType } from "@hono/node-server";
import type { Bot } from "grammy";
import { startBot } from "../bot.js";
import { log } from "../log.js";

type StartableBot = Bot;

type ShutdownContext = {
  server: ServerType;
  botPromise: Promise<StartableBot | null>;
};

export async function startBotSafely(): Promise<StartableBot | null> {
  try {
    return await startBot();
  } catch (err) {
    log.error(
      "bot",
      "failed to start",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function stopBotSafely(bot: StartableBot | null): Promise<void> {
  if (!bot) return;

  try {
    await bot.stop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message !== "Aborted delay") {
      log.warn("bot", "stop failed", message);
    }
  }

  log.info("bot", "polling stopped");
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve) => {
    server.close((err) => {
      if (err) {
        log.error(
          "boot",
          "http server close failed",
          err instanceof Error ? err.message : err,
        );
      } else {
        log.info("boot", "http server closed");
      }
      resolve();
    });
  });
}

export function createShutdownHandler(context: ShutdownContext) {
  let isShuttingDown = false;

  return async (signal: NodeJS.Signals): Promise<number> => {
    if (isShuttingDown) return 0;
    isShuttingDown = true;
    log.info("boot", `shutdown requested (${signal})`);

    try {
      const bot = await context.botPromise;
      await stopBotSafely(bot);
      await closeServer(context.server);
      return 0;
    } catch (err) {
      log.error(
        "boot",
        "shutdown failed",
        err instanceof Error ? err.message : err,
      );
      return 1;
    }
  };
}

export function installSignalHandlers(
  handler: (signal: NodeJS.Signals) => Promise<number>,
): void {
  const runHandler = (signal: NodeJS.Signals) => {
    void handler(signal).then((code) => {
      process.exit(code);
    });
  };

  process.on("SIGINT", () => runHandler("SIGINT"));
  process.on("SIGTERM", () => runHandler("SIGTERM"));
}
