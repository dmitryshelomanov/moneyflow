import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { verifySessionToken } from "../../auth.js";
import { isTelegramAllowed } from "../../telegram-acl.js";
import type { ApiVariables } from "../../routes/context.js";
import { unauthorized } from "../../routes/helpers/http.js";

export const sessionAuthMiddleware: MiddlewareHandler<{
  Variables: ApiVariables;
}> = async (c, next) => {
  const token = getCookie(c, "mf_session");
  if (!token) return unauthorized(c);

  const session = verifySessionToken(token);
  if (!session || !isTelegramAllowed(session.telegramId)) {
    return unauthorized(c);
  }

  c.set("user", { telegramId: session.telegramId, name: session.name });
  await next();
};
