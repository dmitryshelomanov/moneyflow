import type { Context } from "hono";
import type { z } from "zod";

type ValidationResult<T> =
  { ok: true; data: T } | { ok: false; response: Response };

export async function readJsonBody(c: Context): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export function validateBody<TSchema extends z.ZodTypeAny>(
  c: Context,
  schema: TSchema,
  body: unknown,
): ValidationResult<z.infer<TSchema>> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: badRequest(c, parsed.error.flatten()),
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateQuery<TSchema extends z.ZodTypeAny>(
  c: Context,
  schema: TSchema,
  query: unknown,
): ValidationResult<z.infer<TSchema>> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    return {
      ok: false,
      response: badRequest(c, parsed.error.flatten()),
    };
  }
  return { ok: true, data: parsed.data };
}

export function badRequest(c: Context, error: unknown): Response {
  return c.json({ error }, 400);
}

export function unauthorized(c: Context): Response {
  return c.json({ error: "Unauthorized" }, 401);
}

export function notFound(c: Context): Response {
  return c.json({ error: "Not found" }, 404);
}
