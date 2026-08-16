import type { ParseBatch, ParseResult, Transaction } from "@moneyflow/shared";
import { sqlite } from "../db/client.js";
import {
  createCategory,
  createTransaction,
  findCategoryByName,
  getBalance,
  getSettings,
} from "./money.js";

function resolveCategoryId(parsed: ParseResult): string | null {
  if (parsed.categoryName) {
    const existing = findCategoryByName(parsed.categoryName);
    if (existing) return existing.id;
    if (parsed.createCategory) {
      const created = createCategory({
        name: parsed.createCategory.name,
        icon: parsed.createCategory.icon ?? "Circle",
        prompt: null,
      });
      return created.id;
    }
    const created = createCategory({
      name: parsed.categoryName,
      icon: "Circle",
      prompt: null,
    });
    return created.id;
  }

  if (parsed.createCategory) {
    const existing = findCategoryByName(parsed.createCategory.name);
    if (existing) return existing.id;
    const created = createCategory({
      name: parsed.createCategory.name,
      icon: parsed.createCategory.icon ?? "Circle",
      prompt: null,
    });
    return created.id;
  }

  return null;
}

export function applyParseResult(
  parsed: ParseResult,
  opts: { source: "telegram" | "web"; rawText?: string | null },
) {
  const s = getSettings();
  const categoryId = resolveCategoryId(parsed);

  const tx = createTransaction({
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency ?? s.currency,
    categoryId,
    occurredAt: parsed.occurredAt,
    note: parsed.note,
    source: opts.source,
    rawText: opts.rawText ?? null,
  });

  return {
    transaction: tx,
    balance: getBalance(),
    settings: s,
    parse: parsed,
  };
}

export function applyParseBatch(
  batch: ParseBatch,
  opts: { source: "telegram" | "web"; rawText?: string | null },
) {
  const runAtomic = sqlite.transaction(() => {
    const s = getSettings();
    const saved: Transaction[] = [];
    const parses: ParseResult[] = [];

    for (const item of batch.transactions) {
      const result = applyParseResult(item, opts);
      saved.push(result.transaction);
      parses.push(result.parse);
    }

    return {
      kind: batch.kind,
      transactions: saved,
      /** First saved tx — convenience for single/receipt clients. */
      transaction: saved[0]!,
      balance: getBalance(),
      settings: s,
      parse: parses[0]!,
      parses,
    };
  });

  return runAtomic();
}
