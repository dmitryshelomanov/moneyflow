import { CreateCategorySchema, UpdateCategorySchema } from "@moneyflow/shared";
import { Hono } from "hono";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../services/money.js";
import type { ApiVariables } from "../context.js";
import {
  badRequest,
  notFound,
  readJsonBody,
  validateBody,
} from "../helpers/http.js";

export function registerCategoryRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.get("/categories", (c) => {
    return c.json(listCategories());
  });

  router.post("/categories", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, CreateCategorySchema, body);
    if (!validated.ok) return validated.response;

    return c.json(createCategory(validated.data), 201);
  });

  router.patch("/categories/:id", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, UpdateCategorySchema, body);
    if (!validated.ok) return validated.response;

    const updated = updateCategory(c.req.param("id"), validated.data);
    if (!updated) return notFound(c);
    return c.json(updated);
  });

  router.delete("/categories/:id", (c) => {
    const ok = deleteCategory(c.req.param("id"));
    if (!ok) return notFound(c);
    return c.json({ ok: true });
  });
}
