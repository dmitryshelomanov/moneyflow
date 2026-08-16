import {
  type BalancePoint,
  type StatsSummary,
  type TimeseriesPoint,
} from "@moneyflow/shared";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories, transactions } from "../db/schema.js";
import { getAccountById, getTotalOpeningBalance } from "./accounts.js";
import { buildTransactionDateRangeConditions } from "./transaction-date-filters.js";
import { listTransactionsForStats } from "./transactions.js";
import { getSettings } from "./settings.js";

type TransactionType = "expense" | "income";
type Granularity = "day" | "week" | "month" | "year";
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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

function nowIso() {
  return new Date().toISOString();
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

function weekdayFromDate(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 6 : day - 1) as Weekday;
}

function withOptionalAccountFilter(
  conditions: ReturnType<typeof buildTransactionDateRangeConditions>,
  accountId?: string,
) {
  if (accountId) {
    conditions.push(eq(transactions.accountId, accountId));
  }
  return conditions;
}

export function getBalance(atIso?: string, accountId?: string): number {
  const at = atIso ?? nowIso();
  const where = accountId
    ? and(
        lte(transactions.occurredAt, at),
        eq(transactions.accountId, accountId),
      )
    : lte(transactions.occurredAt, at);
  const rows = db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type)
    .all();

  const { income, expense } = parseTypeTotals(rows);
  const opening = accountId
    ? (getAccountById(accountId)?.openingBalance ?? 0)
    : getTotalOpeningBalance();
  return opening + income - expense;
}

export function getSummary(
  from?: string,
  to?: string,
  accountId?: string,
): StatsSummary {
  const s = getSettings();
  const balance = getBalance(to ?? nowIso(), accountId);
  const conditions = withOptionalAccountFilter(
    buildTransactionDateRangeConditions(from, to),
    accountId,
  );

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
  accountId?: string,
): TimeseriesPoint[] {
  const rows = listTransactionsForStats({ from, to, accountId });
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

/** Running balance at the end of each bucket in [from, to]. */
export function getBalanceSeries(
  from: string,
  to: string,
  granularity: Granularity = "month",
  accountId?: string,
): BalancePoint[] {
  const before = new Date(from);
  before.setMilliseconds(before.getMilliseconds() - 1);
  let running = getBalance(before.toISOString(), accountId);

  const nets = new Map<string, number>();
  for (const row of listTransactionsForStats({ from, to, accountId })) {
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
  accountId?: string,
): ParetoPoint[] {
  const conditions = withOptionalAccountFilter(
    buildTransactionDateRangeConditions(from, to),
    accountId,
  );
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

export function getSpendingHeatmap(
  from: string,
  to: string,
  type: TransactionType = "expense",
  accountId?: string,
): HeatmapCell[] {
  const rows = listTransactionsForStats({ from, to, type, accountId });
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
