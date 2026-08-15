import { TelegramAuthSchema } from "@moneyflow/shared";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import {
  createSessionToken,
  verifySessionToken,
  verifyTelegramLogin,
} from "../../auth.js";
import { env } from "../../env.js";
import {
  getAllowedTelegramIds,
  isTelegramAllowed,
} from "../../telegram-acl.js";
import { badRequest, readJsonBody, validateBody } from "../helpers/http.js";

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function setSession(
  c: Parameters<typeof setCookie>[0],
  id: number,
  name: string,
) {
  const token = createSessionToken(id, name);
  setCookie(c, "mf_session", token, {
    ...sessionCookieOptions,
    secure: env.NODE_ENV === "production",
  });
}

function buildTelegramCheck(
  data: Pick<
    Awaited<ReturnType<typeof TelegramAuthSchema.parseAsync>>,
    | "id"
    | "first_name"
    | "last_name"
    | "username"
    | "photo_url"
    | "auth_date"
    | "hash"
  >,
): Record<string, string | number> {
  const check: Record<string, string | number> = {
    id: data.id,
    first_name: data.first_name,
    auth_date: data.auth_date,
    hash: data.hash,
  };
  if (data.last_name) check.last_name = data.last_name;
  if (data.username) check.username = data.username;
  if (data.photo_url) check.photo_url = data.photo_url;
  return check;
}

export function registerPublicAuthRoutes(router: Hono) {
  router.post("/auth/telegram", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, TelegramAuthSchema, body);
    if (!validated.ok) return validated.response;

    const data = validated.data;
    if (Date.now() / 1000 - data.auth_date > 86400) {
      return c.json({ error: "Auth expired" }, 401);
    }

    const bypass =
      env.NODE_ENV === "development" &&
      !env.TELEGRAM_BOT_TOKEN &&
      isTelegramAllowed(data.id);
    if (!bypass && !verifyTelegramLogin(buildTelegramCheck(data))) {
      return c.json({ error: "Invalid Telegram signature" }, 401);
    }

    if (!isTelegramAllowed(data.id)) {
      return c.json({ error: "User not allowed" }, 403);
    }

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    setSession(c, data.id, name);
    return c.json({ ok: true, user: { id: data.id, name } });
  });

  router.post("/auth/dev-login", async (c) => {
    if (env.NODE_ENV === "production") {
      return c.json({ error: "Not available" }, 404);
    }

    const body = (await readJsonBody(c)) ?? {};
    if (typeof body !== "object" || body === null) {
      return badRequest(c, "Invalid JSON body");
    }

    const record = body as Record<string, unknown>;
    const allowed = getAllowedTelegramIds();
    const id = Number(record.id ?? [...allowed][0] ?? 1);
    if (allowed.size > 0 && !isTelegramAllowed(id)) {
      return c.json({ error: "User not allowed" }, 403);
    }

    const name = String(record.name ?? "Dev User");
    setSession(c, id, name);
    return c.json({ ok: true, user: { id, name } });
  });

  router.post("/auth/logout", (c) => {
    deleteCookie(c, "mf_session", { path: "/" });
    return c.json({ ok: true });
  });

  router.get("/auth/me", (c) => {
    const token = getCookie(c, "mf_session");
    if (!token) return c.json({ user: null });

    const session = verifySessionToken(token);
    if (!session) return c.json({ user: null });

    return c.json({ user: { id: session.telegramId, name: session.name } });
  });
}
