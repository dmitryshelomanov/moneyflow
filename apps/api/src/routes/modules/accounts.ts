import { CreateAccountSchema, UpdateAccountSchema } from "@moneyflow/shared";
import { Hono } from "hono";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "../../services/money.js";
import type { ApiVariables } from "../context.js";
import {
  badRequest,
  notFound,
  readJsonBody,
  validateBody,
} from "../helpers/http.js";

export function registerAccountRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.get("/accounts", (c) => c.json(listAccounts()));

  router.post("/accounts", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, CreateAccountSchema, body);
    if (!validated.ok) return validated.response;

    return c.json(createAccount(validated.data), 201);
  });

  router.patch("/accounts/:id", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, UpdateAccountSchema, body);
    if (!validated.ok) return validated.response;

    const updated = updateAccount(c.req.param("id"), validated.data);
    if (!updated) return notFound(c);
    return c.json(updated);
  });

  router.delete("/accounts/:id", (c) => {
    const ok = deleteAccount(c.req.param("id"));
    if (!ok) return notFound(c);
    return c.json({ ok: true });
  });
}
