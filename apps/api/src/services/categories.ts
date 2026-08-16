import {
  CreateCategorySchema,
  type CreateCategory,
  type UpdateCategory,
} from "@moneyflow/shared";
import { asc, eq } from "drizzle-orm";
import { newId } from "../auth.js";
import { db } from "../db/client.js";
import { categories } from "../db/schema.js";

function nowIso() {
  return new Date().toISOString();
}

export function getCategoryById(id: string) {
  return (
    db.select().from(categories).where(eq(categories.id, id)).get() ?? null
  );
}

export function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.name)).all();
}

export function createCategory(input: CreateCategory) {
  const parsed = CreateCategorySchema.parse(input);
  const row = {
    id: newId(),
    name: parsed.name.trim(),
    icon: parsed.icon || "Circle",
    prompt: parsed.prompt ?? null,
    createdAt: nowIso(),
  };
  db.insert(categories).values(row).run();
  return row;
}

export function updateCategory(id: string, input: UpdateCategory) {
  const existing = getCategoryById(id);
  if (!existing) return null;
  const next = {
    name: input.name?.trim() ?? existing.name,
    icon: input.icon ?? existing.icon,
    prompt: input.prompt === undefined ? existing.prompt : input.prompt,
  };
  db.update(categories).set(next).where(eq(categories.id, id)).run();
  return getCategoryById(id)!;
}

export function deleteCategory(id: string) {
  const existing = getCategoryById(id);
  if (!existing) return false;
  db.delete(categories).where(eq(categories.id, id)).run();
  return true;
}

export function findCategoryByName(name: string) {
  const all = listCategories();
  const needle = name.trim().toLowerCase();
  return all.find((c) => c.name.toLowerCase() === needle) ?? null;
}
