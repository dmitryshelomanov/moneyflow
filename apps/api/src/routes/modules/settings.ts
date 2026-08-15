import { UpdateSettingsSchema } from "@moneyflow/shared";
import { Hono } from "hono";
import { getSettings, updateSettings } from "../../services/money.js";
import type { ApiVariables } from "../context.js";
import { badRequest, readJsonBody, validateBody } from "../helpers/http.js";

export function registerSettingsRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.get("/settings", (c) => c.json(getSettings()));

  router.patch("/settings", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, UpdateSettingsSchema, body);
    if (!validated.ok) return validated.response;

    return c.json(updateSettings(validated.data));
  });
}
