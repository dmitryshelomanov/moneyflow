import {
  CreateCategorySchema,
  CreateTransactionSchema,
  type CreateCategory,
  type CreateTransaction,
  type Settings,
  type StatsSummary,
  type TimeseriesPoint,
  type BalancePoint,
  type UpdateCategory,
  type UpdateSettings,
  type UpdateTransaction,
  toMinorUnits,
} from "@moneyflow/shared";
import { and, asc, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import { newId } from "../auth.js";
import { db } from "../db/client.js";
import { categories, settings, transactions } from "../db/schema.js";
import { env } from "../env.js";

type TransactionType = "expense" | "income";
type Granularity = "day" | "week" | "month" | "year";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type TransactionFilters = {
  from?: string;
  to?: string;
  type?: TransactionType;
  categoryId?: string;
};

type ListTransactionsFilters = TransactionFilters & {
  limit?: number;
};

type ListTransactionsPageFilters = TransactionFilters & {
  limit?: number;
  cursor?: string;
};

export type ParetoPoint = {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  total: number;
  sharePct: number;
  cumulativePct: number;
};

export type HeatmapCell = {
  weekday: Weekday;
  hour: number;
  count: number;
  total: number;
};

function nowIso() {
  return new Date().toISOString();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatYmd(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatYearMonth(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function getStartOfWeek(date: Date) {
  const weekStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  return weekStart;
}

function toBucketKey(date: Date, granularity: Granularity): string {
  if (granularity === "year") return String(date.getFullYear());
  if (granularity === "month") return formatYearMonth(date);
  if (granularity === "week") return formatYmd(getStartOfWeek(date));
  return formatYmd(date);
}

function parseTypeTotals(
  rows: Array<{ type: TransactionType; total: number }>,
) {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === "income") income = Number(row.total);
    if (row.type === "expense") expense = Number(row.total);
  }
  return { income, expense };
}

function getCategoryById(id: string) {
  return (
    db.select().from(categories).where(eq(categories.id, id)).get() ?? null
  );
}

function getTransactionById(id: string) {
  return (
    db.select().from(transactions).where(eq(transactions.id, id)).get() ?? null
  );
}

function buildDateRangeConditions(from?: string, to?: string) {
  const conditions = [];
  if (from) conditions.push(gte(transactions.occurredAt, from));
  if (to) conditions.push(lte(transactions.occurredAt, to));
  return conditions;
}

function listTransactionsForStats(filters: TransactionFilters) {
  const conditions = buildTransactionsFilters(filters);
  return db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .all();
}

export function getSettings(): Settings {
  const row = db.select().from(settings).limit(1).all()[0];
  if (!row) {
    throw new Error("Settings not initialized");
  }
  return {
    currency: row.currency,
    openingBalance: row.openingBalance,
    categorizationPrompt: row.categorizationPrompt,
    aiModel: env.ROUTERAI_MODEL,
    allowedTelegramIds: row.allowedTelegramIds,
  };
}

export function updateSettings(input: UpdateSettings): Settings {
  const current = getSettings();
  const openingBalance =
    input.openingBalance === undefined
      ? current.openingBalance
      : input.openingBalanceInMinor
        ? Math.round(input.openingBalance)
        : toMinorUnits(input.openingBalance);

  db.update(settings)
    .set({
      currency: input.currency ?? current.currency,
      openingBalance,
      categorizationPrompt:
        input.categorizationPrompt ?? current.categorizationPrompt,
      allowedTelegramIds:
        input.allowedTelegramIds ?? current.allowedTelegramIds,
    })
    .run();

  return getSettings();
}

export function getStatsMeta() {
  const row = db
    .select({
      firstTransactionAt: sql<string | null>`min(${transactions.occurredAt})`,
    })
    .from(transactions)
    .get();
  return {
    firstTransactionAt: row?.firstTransactionAt ?? null,
  };
}

export function listCategories(type?: "expense" | "income") {
  const byType = type ? eq(categories.type, type) : undefined;
  return db
    .select()
    .from(categories)
    .where(byType)
    .orderBy(asc(categories.type), asc(categories.name))
    .all();
}

export function createCategory(input: CreateCategory) {
  const parsed = CreateCategorySchema.parse(input);
  const row = {
    id: newId(),
    name: parsed.name.trim(),
    type: parsed.type,
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
    type: input.type ?? existing.type,
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

export function findCategoryByName(name: string, type?: "expense" | "income") {
  const all = listCategories(type);
  const needle = name.trim().toLowerCase();
  return all.find((c) => c.name.toLowerCase() === needle) ?? null;
}

function resolveAmount(amount: number, amountInMinor?: boolean) {
  return amountInMinor ? Math.round(amount) : toMinorUnits(amount);
}

export function createTransaction(input: CreateTransaction) {
  const parsed = CreateTransactionSchema.parse(input);
  const s = getSettings();
  const row = {
    id: newId(),
    type: parsed.type,
    amount: resolveAmount(parsed.amount, parsed.amountInMinor),
    currency: parsed.currency ?? s.currency,
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

  const next = {
    type: input.type ?? existing.type,
    amount:
      input.amount === undefined
        ? existing.amount
        : resolveAmount(input.amount, input.amountInMinor),
    currency: input.currency ?? existing.currency,
    categoryId:
      input.categoryId === undefined ? existing.categoryId : input.categoryId,
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

function buildTransactionsFilters(filters: TransactionFilters) {
  const conditions = buildDateRangeConditions(filters.from, filters.to);
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryId)
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  return conditions;
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

type TransactionsCursor = {
  occurredAt: string;
  createdAt: string;
  id: string;
};

const DEFAULT_TRANSACTIONS_PAGE_LIMIT = 50;
const MAX_TRANSACTIONS_PAGE_LIMIT = 200;

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
    throw new Error("Invalid cursor");
  }
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

export function getBalance(atIso?: string): number {
  const s = getSettings();
  const at = atIso ?? nowIso();
  const rows = db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(lte(transactions.occurredAt, at))
    .groupBy(transactions.type)
    .all();

  const { income, expense } = parseTypeTotals(rows);
  return s.openingBalance + income - expense;
}

export function getSummary(from?: string, to?: string): StatsSummary {
  const s = getSettings();
  const balance = getBalance(to ?? nowIso());
  const conditions = buildDateRangeConditions(from, to);

  const periodRows = db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transactions.type)
    .all();

  const { income: periodIncome, expense: periodExpense } =
    parseTypeTotals(periodRows);

  const byCat = db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      categoryName: categories.name,
      icon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transactions.categoryId, transactions.type)
    .all();

  return {
    currency: s.currency,
    balance,
    periodIncome,
    periodExpense,
    byCategory: byCat.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "Без категории",
      icon: r.icon,
      type: r.type,
      total: Number(r.total),
    })),
  };
}

export function getTimeseries(
  from: string,
  to: string,
  granularity: Granularity = "day",
): TimeseriesPoint[] {
  // Stats must aggregate the full range, not the paginated transaction feed.
  const rows = listTransactionsForStats({ from, to });
  const map = new Map<string, { income: number; expense: number }>();

  for (const row of rows) {
    const key = toBucketKey(new Date(row.occurredAt), granularity);
    const bucket = map.get(key) ?? { income: 0, expense: 0 };
    if (row.type === "income") bucket.income += row.amount;
    else bucket.expense += row.amount;
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, income: v.income, expense: v.expense }));
}

function bucketKey(iso: string, granularity: Granularity): string {
  return toBucketKey(new Date(iso), granularity);
}

function fillBalanceKeys(
  from: string,
  to: string,
  granularity: Granularity,
): string[] {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  const keys: string[] = [];

  if (granularity === "year") {
    const cur = new Date(start.getFullYear(), 0, 1);
    const last = new Date(end.getFullYear(), 0, 1);
    while (cur <= last) {
      keys.push(String(cur.getFullYear()));
      cur.setFullYear(cur.getFullYear() + 1);
    }
    return keys;
  }

  if (granularity === "month") {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      keys.push(formatYearMonth(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return keys;
  }

  if (granularity === "week") {
    const cur = new Date(start);
    const monday = getStartOfWeek(cur);
    cur.setTime(monday.getTime());
    while (cur <= end) {
      keys.push(formatYmd(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return keys;
  }

  const cur = new Date(start);
  while (cur <= end) {
    keys.push(formatYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

/** Running balance at the end of each bucket in [from, to]. */
export function getBalanceSeries(
  from: string,
  to: string,
  granularity: Granularity = "month",
): BalancePoint[] {
  const before = new Date(from);
  before.setMilliseconds(before.getMilliseconds() - 1);
  let running = getBalance(before.toISOString());

  const nets = new Map<string, number>();
  // Balance series for stats must use the full range (no pagination limits).
  for (const row of listTransactionsForStats({ from, to })) {
    const key = bucketKey(row.occurredAt, granularity);
    const delta = row.type === "income" ? row.amount : -row.amount;
    nets.set(key, (nets.get(key) ?? 0) + delta);
  }

  return fillBalanceKeys(from, to, granularity).map((date) => {
    running += nets.get(date) ?? 0;
    return { date, balance: running };
  });
}

export function getCategoryPareto(
  from: string,
  to: string,
  type: TransactionType = "expense",
): ParetoPoint[] {
  const conditions = buildDateRangeConditions(from, to);
  conditions.push(eq(transactions.type, type));

  const byCat = db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      categoryName: categories.name,
      icon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))
    .groupBy(transactions.categoryId)
    .all()
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? "Без категории",
      icon: row.icon,
      total: Number(row.total),
    }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = byCat.reduce((sum, row) => sum + row.total, 0);
  let cumulative = 0;
  return byCat.map((row) => {
    cumulative += row.total;
    const sharePct =
      grandTotal > 0 ? Math.round((row.total / grandTotal) * 1000) / 10 : 0;
    const cumulativePct =
      grandTotal > 0 ? Math.round((cumulative / grandTotal) * 1000) / 10 : 0;
    return {
      ...row,
      sharePct,
      cumulativePct,
    };
  });
}

function weekdayFromDate(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 6 : day - 1) as Weekday;
}

export function getSpendingHeatmap(
  from: string,
  to: string,
  type: TransactionType = "expense",
): HeatmapCell[] {
  const rows = listTransactionsForStats({ from, to, type });
  const map = new Map<string, HeatmapCell>();

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${weekday}-${hour}`;
      map.set(key, {
        weekday: weekday as Weekday,
        hour,
        count: 0,
        total: 0,
      });
    }
  }

  for (const row of rows) {
    const date = new Date(row.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = weekdayFromDate(date);
    const hour = date.getHours();
    const key = `${weekday}-${hour}`;
    const cell = map.get(key);
    if (!cell) continue;
    cell.count += 1;
    cell.total += row.amount;
  }

  return [...map.values()].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.hour - b.hour;
  });
}
