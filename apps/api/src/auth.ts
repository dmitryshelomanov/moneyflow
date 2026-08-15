import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env.js";

export type SessionPayload = {
  telegramId: number;
  name: string;
  exp: number;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(data: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(data)
    .digest("base64url");
}

export function createSessionToken(telegramId: number, name: string): string {
  const payload: SessionPayload = {
    telegramId,
    name,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Telegram Login Widget hash verification */
export function verifyTelegramLogin(
  data: Record<string, string | number>,
): boolean {
  const hash = String(data.hash ?? "");
  if (!hash || !env.TELEGRAM_BOT_TOKEN) return false;

  const pairs = Object.keys(data)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  const secretKey = createHash("sha256")
    .update(env.TELEGRAM_BOT_TOKEN)
    .digest();
  const computed = createHmac("sha256", secretKey).update(pairs).digest("hex");

  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function newId(): string {
  return randomBytes(12).toString("hex");
}
