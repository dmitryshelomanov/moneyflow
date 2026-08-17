import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
config({ path: path.join(root, ".env") });
config({ path: path.join(process.cwd(), ".env") });

function telegramBotIdFromToken(token: string): string {
  const id = token.split(":")[0] ?? "";
  return /^\d+$/.test(id) ? id : "";
}

const EnvSchema = z.object({
  ACCESS_KEY: z.string().min(8),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_BOT_ID: z.string().optional().default(""),
  VITE_TELEGRAM_BOT_ID: z.string().optional().default(""),
  ALLOWED_TELEGRAM_IDS: z.string().optional().default(""),
  ROUTERAI_API_KEY: z.string().optional().default(""),
  ROUTERAI_BASE_URL: z.string().url().default("https://routerai.ru/api/v1"),
  ROUTERAI_MODEL: z.string().default("openai/gpt-4o"),
  SESSION_SECRET: z.string().min(8),
  DATABASE_PATH: z.string().default("./data/moneyflow.db"),
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

const raw = parsed.data;
export const env = {
  ...raw,
  telegramBotId:
    raw.TELEGRAM_BOT_ID ||
    raw.VITE_TELEGRAM_BOT_ID ||
    telegramBotIdFromToken(raw.TELEGRAM_BOT_TOKEN),
  DATABASE_PATH:
    raw.DATABASE_PATH === ":memory:" || path.isAbsolute(raw.DATABASE_PATH)
      ? raw.DATABASE_PATH
      : path.resolve(root, raw.DATABASE_PATH),
};

export function parseTelegramIds(rawIds: string): number[] {
  return rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

/** Env-only whitelist (settings IDs are merged in telegram-acl). */
export const allowedTelegramIds = new Set(
  parseTelegramIds(env.ALLOWED_TELEGRAM_IDS),
);
