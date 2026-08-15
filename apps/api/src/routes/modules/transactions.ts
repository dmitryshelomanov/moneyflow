import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
} from "@moneyflow/shared";
import { Hono } from "hono";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactionsPage,
  updateTransaction,
} from "../../services/money.js";
import type { ApiVariables } from "../context.js";
import {
  badRequest,
  notFound,
  readJsonBody,
  validateBody,
} from "../helpers/http.js";

export function registerTransactionRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.get("/transactions", (c) => {
    try {
      return c.json(
        listTransactionsPage({
          from: c.req.query("from") ?? undefined,
          to: c.req.query("to") ?? undefined,
          type: c.req.query("type") as "expense" | "income" | undefined,
          categoryId: c.req.query("categoryId") ?? undefined,
          limit: c.req.query("limit")
            ? Number(c.req.query("limit"))
            : undefined,
          cursor: c.req.query("cursor") ?? undefined,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid cursor") {
        return badRequest(c, "Invalid cursor");
      }
      throw error;
    }
  });

  router.get("/transactions/:id", (c) => {
    const tx = getTransaction(c.req.param("id"));
    if (!tx) return notFound(c);
    return c.json(tx);
  });

  router.post("/transactions", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, CreateTransactionSchema, body);
    if (!validated.ok) return validated.response;

    return c.json(
      createTransaction({
        ...validated.data,
        source: validated.data.source ?? "web",
      }),
      201,
    );
  });

  router.patch("/transactions/:id", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, UpdateTransactionSchema, body);
    if (!validated.ok) return validated.response;

    const updated = updateTransaction(c.req.param("id"), validated.data);
    if (!updated) return notFound(c);
    return c.json(updated);
  });

  router.delete("/transactions/:id", (c) => {
    const ok = deleteTransaction(c.req.param("id"));
    if (!ok) return notFound(c);
    return c.json({ ok: true });
  });
}
