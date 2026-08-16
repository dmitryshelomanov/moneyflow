import {
  CreateTransactionSchema,
  type CreateTransaction,
  type UpdateTransaction,
  toMinorUnits,
} from "@moneyflow/shared";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { AppError } from "../errors.js";
import { newId } from "../auth.js";
import { db } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { getAccountById, getDefaultAccount } from "./accounts.js";
import { buildTransactionDateRangeConditions } from "./transaction-date-filters.js";
import { getCategoryById } from "./categories.js";
import { getSettings } from "./settings.js";

type TransactionType = "expense" | "income";

type TransactionFilters = {
  from?: string;
  to?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  q?: string;
};

export type ListTransactionsFilters = TransactionFilters & {
  limit?: number;
};

export type ListTransactionsPageFilters = TransactionFilters & {
  limit?: number;
  cursor?: string;
};

type TransactionsCursor = {
  occurredAt: string;
  createdAt: string;
  id: string;
};

const DEFAULT_TRANSACTIONS_PAGE_LIMIT = 50;
const MAX_TRANSACTIONS_PAGE_LIMIT = 200;

function nowIso() {
  return new Date().toISOString();
}

function resolveAmount(amount: number, amountInMinor?: boolean) {
  return amountInMinor ? Math.round(amount) : toMinorUnits(amount);
}

function getTransactionById(id: string) {
  return (
    db.select().from(transactions).where(eq(transactions.id, id)).get() ?? null
  );
}

function buildTransactionsFilters(filters: TransactionFilters) {
  const conditions = buildTransactionDateRangeConditions(
    filters.from,
    filters.to,
  );
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  const q = filters.q?.trim();
  if (q) {
    conditions.push(
      sql`instr(unicode_lower(${transactions.note}), ${q.toLocaleLowerCase("ru")}) > 0`,
    );
  }
  return conditions;
}

function validateCategoryForTransaction(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = getCategoryById(categoryId);
  if (!category) {
    throw new AppError(400, "Invalid categoryId");
  }
}

function resolveAccountId(accountId: string | null | undefined): string {
  if (!accountId) return getDefaultAccount().id;
  const account = getAccountById(accountId);
  if (!account) {
    throw new AppError(400, "Invalid accountId");
  }
  return account.id;
}

function clampPageLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_TRANSACTIONS_PAGE_LIMIT;
  return Math.min(
    Math.max(Math.trunc(limit as number), 1),
    MAX_TRANSACTIONS_PAGE_LIMIT,
  );
}

function encodeTransactionsCursor(cursor: TransactionsCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeTransactionsCursor(cursor: string): TransactionsCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<TransactionsCursor>;
    if (
      typeof parsed.occurredAt !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Invalid cursor format");
    }
    return {
      occurredAt: parsed.occurredAt,
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    throw new AppError(400, "Invalid cursor");
  }
}

export function createTransaction(input: CreateTransaction) {
  const parsed = CreateTransactionSchema.parse(input);
  const accountId = resolveAccountId(parsed.accountId);
  validateCategoryForTransaction(parsed.categoryId);
  const s = getSettings();
  const row = {
    id: newId(),
    type: parsed.type,
    amount: resolveAmount(parsed.amount, parsed.amountInMinor),
    currency: parsed.currency ?? s.currency,
    accountId,
    categoryId: parsed.categoryId ?? null,
    occurredAt: parsed.occurredAt ?? nowIso(),
    note: parsed.note ?? null,
    source: parsed.source,
    rawText: parsed.rawText ?? null,
    createdAt: nowIso(),
  };
  db.insert(transactions).values(row).run();
  return row;
}

export function updateTransaction(id: string, input: UpdateTransaction) {
  const existing = getTransactionById(id);
  if (!existing) return null;

  const nextType = input.type ?? existing.type;
  const nextAccountId =
    input.accountId === undefined
      ? (existing.accountId ?? getDefaultAccount().id)
      : resolveAccountId(input.accountId);
  const nextCategoryId =
    input.categoryId === undefined ? existing.categoryId : input.categoryId;
  validateCategoryForTransaction(nextCategoryId);

  const next = {
    type: nextType,
    amount:
      input.amount === undefined
        ? existing.amount
        : resolveAmount(input.amount, input.amountInMinor),
    currency: input.currency ?? existing.currency,
    accountId: nextAccountId,
    categoryId: nextCategoryId,
    occurredAt: input.occurredAt ?? existing.occurredAt,
    note: input.note === undefined ? existing.note : input.note,
  };

  db.update(transactions).set(next).where(eq(transactions.id, id)).run();
  return getTransactionById(id)!;
}

export function deleteTransaction(id: string) {
  const existing = getTransactionById(id);
  if (!existing) return false;
  db.delete(transactions).where(eq(transactions.id, id)).run();
  return true;
}

export function getTransaction(id: string) {
  return getTransactionById(id);
}

export function listTransactions(filters: ListTransactionsFilters) {
  const conditions = buildTransactionsFilters(filters);

  return db
    .select()
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(transactions.occurredAt),
      desc(transactions.createdAt),
      desc(transactions.id),
    )
    .limit(filters.limit ?? 500)
    .all();
}

export function listTransactionsPage(filters: ListTransactionsPageFilters) {
  const pageLimit = clampPageLimit(filters.limit);
  const conditions = buildTransactionsFilters(filters);
  if (filters.cursor) {
    const decoded = decodeTransactionsCursor(filters.cursor);
    conditions.push(
      or(
        lt(transactions.occurredAt, decoded.occurredAt),
        and(
          eq(transactions.occurredAt, decoded.occurredAt),
          lt(transactions.createdAt, decoded.createdAt),
        ),
        and(
          eq(transactions.occurredAt, decoded.occurredAt),
          eq(transactions.createdAt, decoded.createdAt),
          lt(transactions.id, decoded.id),
        ),
      )!,
    );
  }

  const rows = db
    .select()
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(transactions.occurredAt),
      desc(transactions.createdAt),
      desc(transactions.id),
    )
    .limit(pageLimit + 1)
    .all();

  const hasMore = rows.length > pageLimit;
  const items = hasMore ? rows.slice(0, pageLimit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeTransactionsCursor({
          occurredAt: last.occurredAt,
          createdAt: last.createdAt,
          id: last.id,
        })
      : null;

  return {
    items,
    hasMore,
    nextCursor,
  };
}

export function listTransactionsForStats(filters: TransactionFilters) {
  const conditions = buildTransactionsFilters(filters);
  return db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .all();
}
