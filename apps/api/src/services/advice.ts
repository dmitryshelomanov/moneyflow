import {
  FinancePulseResponseSchema,
  SavingsAdviceResponseSchema,
  type FinancePulseResponse,
  type SavingsAdviceResponse,
} from "@moneyflow/shared";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, sqlite } from "../db/client.js";
import { adviceCache, transactions } from "../db/schema.js";
import { log } from "../log.js";
import { getSettings } from "./money.js";
import {
  getCategoryPareto,
  getSpendingHeatmap,
  getSummary,
  getTimeseries,
  listCategories,
  listTransactions,
} from "./money.js";
import { generateFinancePulse, generateSavingsAdvice } from "./ai.js";

type BuildSavingsAdviceInput = {
  from: string;
  to: string;
  maxTips: number;
  userKey?: string;
};

type BuildFinancePulseInput = {
  from: string;
  to: string;
  userKey?: string;
};

type SpendGroup = {
  key: string;
  total: number;
  count: number;
  avgAmount: number;
};

type CategoryGrowth = {
  categoryName: string;
  total: number;
  previousTotal: number;
  delta: number;
  deltaPct: number | null;
};

type LargeExpense = {
  occurredAt: string;
  note: string;
  categoryName: string;
  amount: number;
};

type PatternBucket = {
  label: string;
  total: number;
  count: number;
};

const DEFAULT_ADVICE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_ADVICE_CACHE_USER_KEY = "default";
let adviceCacheTableReady = false;

function getAdviceCacheTtlMs() {
  const fromEnv = Number(process.env.ADVICE_CACHE_TTL_SECONDS ?? "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.round(fromEnv * 1000);
  }
  return DEFAULT_ADVICE_CACHE_TTL_SECONDS * 1000;
}

function ensureAdviceCacheTable() {
  if (adviceCacheTableReady) return;
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS advice_cache (
  key TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  from_ymd TEXT NOT NULL,
  to_ymd TEXT NOT NULL,
  max_tips INTEGER NOT NULL,
  data_version TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_advice_cache_expires_at ON advice_cache(expires_at);
`);
  adviceCacheTableReady = true;
}

function buildAdviceCacheKey(input: {
  userKey: string;
  from: string;
  to: string;
  maxTips: number;
  dataVersion: string;
}) {
  return createHash("sha256")
    .update(
      `${input.userKey}|${input.from}|${input.to}|${input.maxTips}|${input.dataVersion}`,
    )
    .digest("hex");
}

function buildAdviceDataVersion(fromIso: string, toIso: string) {
  const snapshot = db
    .select({
      txCount: sql<number>`count(*)`,
      latestCreatedAt: sql<string | null>`max(${transactions.createdAt})`,
      latestOccurredAt: sql<string | null>`max(${transactions.occurredAt})`,
      signedTotal: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else -${transactions.amount} end), 0)`,
      noteLengthSum: sql<number>`coalesce(sum(length(coalesce(${transactions.note}, ''))), 0)`,
      categoryLengthSum: sql<number>`coalesce(sum(length(coalesce(${transactions.categoryId}, ''))), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.occurredAt, fromIso),
        lte(transactions.occurredAt, toIso),
      ),
    )
    .get();

  return [
    snapshot?.txCount ?? 0,
    snapshot?.signedTotal ?? 0,
    snapshot?.noteLengthSum ?? 0,
    snapshot?.categoryLengthSum ?? 0,
    snapshot?.latestCreatedAt ?? "none",
    snapshot?.latestOccurredAt ?? "none",
  ].join(":");
}

function maybeCleanupExpiredAdviceCache(nowIso: string) {
  if (Math.random() >= 0.1) return;
  db.delete(adviceCache).where(lte(adviceCache.expiresAt, nowIso)).run();
}

function readAdviceFromCache(
  key: string,
  nowIso: string,
): SavingsAdviceResponse | null {
  const cached = db
    .select()
    .from(adviceCache)
    .where(eq(adviceCache.key, key))
    .get();
  if (!cached) {
    log.debug("advice", "cache=miss");
    return null;
  }

  if (cached.expiresAt <= nowIso) {
    log.debug("advice", "cache=expired");
    db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
    return null;
  }

  try {
    const parsedJson = JSON.parse(cached.payload);
    const parsed = SavingsAdviceResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      log.debug("advice", "cache=invalid_payload");
      db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
      return null;
    }
    log.debug("advice", "cache=hit");
    return parsed.data;
  } catch {
    log.debug("advice", "cache=invalid_json");
    db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
    return null;
  }
}

function writeAdviceToCache(input: {
  key: string;
  userKey: string;
  from: string;
  to: string;
  maxTips: number;
  dataVersion: string;
  payload: SavingsAdviceResponse;
  nowIso: string;
}) {
  const expiresAt = new Date(
    new Date(input.nowIso).getTime() + getAdviceCacheTtlMs(),
  ).toISOString();

  db.insert(adviceCache)
    .values({
      key: input.key,
      userKey: input.userKey,
      from: input.from,
      to: input.to,
      maxTips: input.maxTips,
      dataVersion: input.dataVersion,
      payload: JSON.stringify(input.payload),
      createdAt: input.nowIso,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: adviceCache.key,
      set: {
        userKey: input.userKey,
        from: input.from,
        to: input.to,
        maxTips: input.maxTips,
        dataVersion: input.dataVersion,
        payload: JSON.stringify(input.payload),
        createdAt: input.nowIso,
        expiresAt,
      },
    })
    .run();
}

function formatMajor(amountMinor: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function toIsoRange(fromYmd: string, toYmd: string) {
  const from = new Date(fromYmd);
  const to = new Date(toYmd);
  to.setHours(23, 59, 59, 999);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function previousPeriodYmdRange(fromYmd: string, toYmd: string) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const from = new Date(fromYmd);
  const to = new Date(toYmd);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const spanDays = Math.max(
    1,
    Math.floor((to.getTime() - from.getTime()) / oneDayMs) + 1,
  );
  const prevTo = new Date(from.getTime() - oneDayMs);
  const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * oneDayMs);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

function toYmd(iso: string) {
  return iso.slice(0, 10);
}

function fixedLastSixMonthsYmdRange() {
  const toDate = new Date();
  toDate.setHours(0, 0, 0, 0);
  const fromDate = new Date(toDate);
  fromDate.setMonth(fromDate.getMonth() - 6);
  return {
    from: toYmd(fromDate.toISOString()),
    to: toYmd(toDate.toISOString()),
  };
}

function normalizeSpendKey(note: string, categoryName: string) {
  const trimmed = note.trim().toLowerCase();
  const cleaned = trimmed
    .replace(/\d+/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 3) return cleaned;
  return categoryName.toLowerCase();
}

function collectRecurringSpends(
  expenses: LargeExpense[],
  maxItems = 8,
): SpendGroup[] {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const item of expenses) {
    const key = normalizeSpendKey(item.note, item.categoryName);
    const current = grouped.get(key) ?? { total: 0, count: 0 };
    current.total += item.amount;
    current.count += 1;
    grouped.set(key, current);
  }
  return [...grouped.entries()]
    .map(([key, value]) => ({
      key,
      total: value.total,
      count: value.count,
      avgAmount: Math.round(value.total / value.count),
    }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, maxItems);
}

function collectCategoryGrowth(
  currentSummary: ReturnType<typeof getSummary>,
  previousSummary: ReturnType<typeof getSummary>,
  maxItems = 6,
): CategoryGrowth[] {
  const previousMap = new Map(
    previousSummary.byCategory
      .filter((item) => item.type === "expense")
      .map((item) => [item.categoryName, item.total]),
  );

  return currentSummary.byCategory
    .filter((item) => item.type === "expense")
    .map((item) => {
      const previousTotal = previousMap.get(item.categoryName) ?? 0;
      const delta = item.total - previousTotal;
      const deltaPct =
        previousTotal > 0
          ? Math.round((delta / previousTotal) * 1000) / 10
          : null;
      return {
        categoryName: item.categoryName,
        total: item.total,
        previousTotal,
        delta,
        deltaPct,
      };
    })
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, maxItems);
}

function collectLargeExpenses(
  expenses: LargeExpense[],
  dailyAverageExpense: number,
  maxItems = 6,
): LargeExpense[] {
  const threshold = Math.max(
    Math.round(dailyAverageExpense * 1.2),
    Math.round(dailyAverageExpense + 50_000),
    80_000,
  );
  return expenses
    .filter((item) => item.amount >= threshold)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, maxItems);
}

function collectNotePatterns(expenses: LargeExpense[]): PatternBucket[] {
  const patterns = [
    {
      label: "Подписки",
      regex: /подпис|subscription|apple|google|yandex plus/i,
    },
    {
      label: "Доставка еды",
      regex: /delivery|достав|samokat|яндекс еда|dostaevsky/i,
    },
    { label: "Такси", regex: /taxi|такси|uber|yandex go|bolt/i },
    { label: "Кофе и перекус", regex: /coffee|кофе|cafe|бургер|шаурм|snack/i },
    { label: "Маркетплейсы", regex: /ozon|wildberries|wb|market|ali|amazon/i },
  ];

  return patterns
    .map(({ label, regex }) => {
      const matched = expenses.filter((item) => regex.test(item.note));
      return {
        label,
        total: matched.reduce((sum, item) => sum + item.amount, 0),
        count: matched.length,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.total - a.total);
}

export async function buildSavingsAdvice(
  input: BuildSavingsAdviceInput,
): Promise<SavingsAdviceResponse> {
  ensureAdviceCacheTable();
  const fixedRange = fixedLastSixMonthsYmdRange();
  const { fromIso, toIso } = toIsoRange(fixedRange.from, fixedRange.to);
  const previous = previousPeriodYmdRange(fixedRange.from, fixedRange.to);
  const previousRangeIso = toIsoRange(previous.from, previous.to);
  const nowIso = new Date().toISOString();
  maybeCleanupExpiredAdviceCache(nowIso);

  const dataVersion = buildAdviceDataVersion(previousRangeIso.fromIso, toIso);
  const userKey = input.userKey ?? DEFAULT_ADVICE_CACHE_USER_KEY;
  const cacheKey = buildAdviceCacheKey({
    userKey,
    from: input.from,
    to: input.to,
    maxTips: input.maxTips,
    dataVersion,
  });
  const cachedAdvice = readAdviceFromCache(cacheKey, nowIso);
  if (cachedAdvice) return cachedAdvice;

  const [summary, previousSummary, expensePareto, expenseHeatmap, daySeries] =
    await Promise.all([
      getSummary(fromIso, toIso),
      getSummary(previousRangeIso.fromIso, previousRangeIso.toIso),
      getCategoryPareto(fromIso, toIso, "expense"),
      getSpendingHeatmap(fromIso, toIso, "expense"),
      getTimeseries(fromIso, toIso, "day"),
    ]);

  const settings = getSettings();
  const categories = listCategories("expense");
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));
  const rawExpenses = listTransactions({
    from: fromIso,
    to: toIso,
    type: "expense",
    limit: 600,
  });
  const expenses: LargeExpense[] = rawExpenses.map((tx) => ({
    occurredAt: toYmd(tx.occurredAt),
    note: tx.note?.trim() || "Без описания",
    categoryName: tx.categoryId
      ? (categoryMap.get(tx.categoryId) ?? "Без категории")
      : "Без категории",
    amount: tx.amount,
  }));
  const peakCell = expenseHeatmap.reduce((best, cell) => {
    if (!best) return cell;
    return cell.total > best.total ? cell : best;
  }, expenseHeatmap[0] ?? null);

  const totalDailyExpense = daySeries.reduce(
    (sum, point) => sum + point.expense,
    0,
  );
  const dailyAverageExpense =
    daySeries.length > 0 ? Math.round(totalDailyExpense / daySeries.length) : 0;
  const recurringSpends = collectRecurringSpends(expenses);
  const categoryGrowth = collectCategoryGrowth(summary, previousSummary);
  const largeExpenses = collectLargeExpenses(expenses, dailyAverageExpense);
  const notePatterns = collectNotePatterns(expenses);
  const recurringFacts = recurringSpends.map(
    (item) =>
      `${item.key}: ${item.count} операций, всего ${formatMajor(item.total, summary.currency)}, средний чек ${formatMajor(item.avgAmount, summary.currency)}`,
  );
  const growthFacts = categoryGrowth.map((item) => {
    const deltaText = formatMajor(item.delta, summary.currency);
    const pctText =
      item.deltaPct == null ? "новая категория" : `${item.deltaPct}%`;
    return `${item.categoryName}: рост на ${deltaText} (${pctText}) vs прошлый период`;
  });
  const largeExpenseFacts = largeExpenses.map(
    (item) =>
      `${item.occurredAt}: ${item.categoryName}, ${formatMajor(item.amount, summary.currency)}, note="${item.note}"`,
  );
  const patternFacts = notePatterns.map(
    (item) =>
      `${item.label}: ${item.count} операций на ${formatMajor(item.total, summary.currency)}`,
  );
  const preparedFacts = [
    `Расход за период: ${formatMajor(summary.periodExpense, summary.currency)}`,
    `Доход за период: ${formatMajor(summary.periodIncome, summary.currency)}`,
    `Средний расход в день: ${formatMajor(dailyAverageExpense, summary.currency)}`,
    ...recurringFacts,
    ...growthFacts,
    ...largeExpenseFacts,
    ...patternFacts,
  ].slice(0, 40);

  const advice = await generateSavingsAdvice({
    from: fixedRange.from,
    to: fixedRange.to,
    currency: summary.currency || settings.currency,
    maxTips: input.maxTips,
    periodIncome: summary.periodIncome,
    periodExpense: summary.periodExpense,
    balance: summary.balance,
    previousIncome: previousSummary.periodIncome,
    previousExpense: previousSummary.periodExpense,
    topCategories: expensePareto.slice(0, 8).map((item) => ({
      categoryName: item.categoryName,
      total: item.total,
      sharePct: item.sharePct,
    })),
    recurringSpends,
    categoryGrowth,
    largeExpenses,
    notePatterns,
    recentExpenses: expenses.slice(0, 30),
    preparedFacts,
    dailyAverageExpense,
    peakSpendHour: peakCell?.hour ?? null,
    peakSpendWeekday: peakCell?.weekday ?? null,
  });
  writeAdviceToCache({
    key: cacheKey,
    userKey,
    from: input.from,
    to: input.to,
    maxTips: input.maxTips,
    dataVersion,
    payload: advice,
    nowIso,
  });
  return advice;
}

function buildPulseCacheKey(input: {
  userKey: string;
  from: string;
  to: string;
  dataVersion: string;
}) {
  return createHash("sha256")
    .update(
      `pulse-v2|${input.userKey}|${input.from}|${input.to}|${input.dataVersion}`,
    )
    .digest("hex");
}

function readPulseFromCache(
  key: string,
  nowIso: string,
): FinancePulseResponse | null {
  const cached = db
    .select()
    .from(adviceCache)
    .where(eq(adviceCache.key, key))
    .get();
  if (!cached) {
    log.debug("advice", "pulse cache=miss");
    return null;
  }

  if (cached.expiresAt <= nowIso) {
    log.debug("advice", "pulse cache=expired");
    db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
    return null;
  }

  try {
    const parsedJson = JSON.parse(cached.payload);
    const parsed = FinancePulseResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      log.debug("advice", "pulse cache=invalid_payload");
      db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
      return null;
    }
    log.debug("advice", "pulse cache=hit");
    return parsed.data;
  } catch {
    log.debug("advice", "pulse cache=invalid_json");
    db.delete(adviceCache).where(eq(adviceCache.key, key)).run();
    return null;
  }
}

function writePulseToCache(input: {
  key: string;
  userKey: string;
  from: string;
  to: string;
  dataVersion: string;
  payload: FinancePulseResponse;
  nowIso: string;
}) {
  const expiresAt = new Date(
    new Date(input.nowIso).getTime() + getAdviceCacheTtlMs(),
  ).toISOString();

  db.insert(adviceCache)
    .values({
      key: input.key,
      userKey: input.userKey,
      from: input.from,
      to: input.to,
      maxTips: 0,
      dataVersion: input.dataVersion,
      payload: JSON.stringify(input.payload),
      createdAt: input.nowIso,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: adviceCache.key,
      set: {
        userKey: input.userKey,
        from: input.from,
        to: input.to,
        maxTips: 0,
        dataVersion: input.dataVersion,
        payload: JSON.stringify(input.payload),
        createdAt: input.nowIso,
        expiresAt,
      },
    })
    .run();
}

export async function buildFinancePulse(
  input: BuildFinancePulseInput,
): Promise<FinancePulseResponse> {
  ensureAdviceCacheTable();
  const { fromIso, toIso } = toIsoRange(input.from, input.to);
  const previous = previousPeriodYmdRange(input.from, input.to);
  const previousRangeIso = toIsoRange(previous.from, previous.to);
  const nowIso = new Date().toISOString();
  maybeCleanupExpiredAdviceCache(nowIso);

  const dataVersion = buildAdviceDataVersion(previousRangeIso.fromIso, toIso);
  const userKey = input.userKey ?? DEFAULT_ADVICE_CACHE_USER_KEY;
  const cacheKey = buildPulseCacheKey({
    userKey,
    from: input.from,
    to: input.to,
    dataVersion,
  });
  const cached = readPulseFromCache(cacheKey, nowIso);
  if (cached) return cached;

  const [summary, previousSummary, daySeries] = await Promise.all([
    getSummary(fromIso, toIso),
    getSummary(previousRangeIso.fromIso, previousRangeIso.toIso),
    getTimeseries(fromIso, toIso, "day"),
  ]);

  const settings = getSettings();
  const currency = summary.currency || settings.currency;
  const periodNet = summary.periodIncome - summary.periodExpense;
  const previousNet =
    previousSummary.periodIncome - previousSummary.periodExpense;
  const expenseRatioPct =
    summary.periodIncome > 0
      ? Math.round((summary.periodExpense / summary.periodIncome) * 1000) / 10
      : null;
  const incomeDelta = summary.periodIncome - previousSummary.periodIncome;
  const expenseDelta = summary.periodExpense - previousSummary.periodExpense;
  const totalDailyExpense = daySeries.reduce(
    (sum, point) => sum + point.expense,
    0,
  );
  const dailyAverageExpense =
    daySeries.length > 0 ? Math.round(totalDailyExpense / daySeries.length) : 0;

  const previousExpenseMap = new Map(
    previousSummary.byCategory
      .filter((item) => item.type === "expense")
      .map((item) => [item.categoryName, item.total]),
  );
  const previousIncomeMap = new Map(
    previousSummary.byCategory
      .filter((item) => item.type === "income")
      .map((item) => [item.categoryName, item.total]),
  );

  const mapCategories = (
    type: "expense" | "income",
    previousMap: Map<string, number>,
    maxItems: number,
  ) => {
    const rows = summary.byCategory
      .filter((item) => item.type === type)
      .sort((a, b) => b.total - a.total);
    const grandTotal = rows.reduce((sum, item) => sum + item.total, 0);
    return rows.slice(0, maxItems).map((item) => {
      const previousTotal = previousMap.get(item.categoryName) ?? 0;
      const delta = item.total - previousTotal;
      const deltaPct =
        previousTotal > 0
          ? Math.round((delta / previousTotal) * 1000) / 10
          : null;
      const sharePct =
        grandTotal > 0 ? Math.round((item.total / grandTotal) * 1000) / 10 : 0;
      return {
        categoryName: item.categoryName,
        type,
        total: item.total,
        sharePct,
        previousTotal,
        delta,
        deltaPct,
      };
    });
  };

  const topExpenseCategories = mapCategories("expense", previousExpenseMap, 6);
  const topIncomeCategories = mapCategories("income", previousIncomeMap, 4);
  const growingCategories = summary.byCategory
    .filter((item) => item.type === "expense")
    .map((item) => {
      const previousTotal = previousExpenseMap.get(item.categoryName) ?? 0;
      const delta = item.total - previousTotal;
      const deltaPct =
        previousTotal > 0
          ? Math.round((delta / previousTotal) * 1000) / 10
          : null;
      const expenseTotal = summary.periodExpense;
      const sharePct =
        expenseTotal > 0
          ? Math.round((item.total / expenseTotal) * 1000) / 10
          : 0;
      return {
        categoryName: item.categoryName,
        type: "expense" as const,
        total: item.total,
        sharePct,
        previousTotal,
        delta,
        deltaPct,
      };
    })
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);

  const ai = await generateFinancePulse({
    from: input.from,
    to: input.to,
    currency,
    periodIncome: summary.periodIncome,
    periodExpense: summary.periodExpense,
    periodNet,
    balance: summary.balance,
    expenseRatioPct,
    previousIncome: previousSummary.periodIncome,
    previousExpense: previousSummary.periodExpense,
    previousNet,
    incomeDelta,
    expenseDelta,
    dailyAverageExpense,
    topExpenseCategories,
    topIncomeCategories,
    growingCategories,
  });

  const response: FinancePulseResponse = {
    period: { from: input.from, to: input.to },
    currency,
    metrics: {
      periodIncome: summary.periodIncome,
      periodExpense: summary.periodExpense,
      periodNet,
      balance: summary.balance,
      expenseRatioPct,
      previousIncome: previousSummary.periodIncome,
      previousExpense: previousSummary.periodExpense,
      previousNet,
      incomeDelta,
      expenseDelta,
      dailyAverageExpense,
    },
    topExpenseCategories,
    topIncomeCategories,
    growingCategories,
    verdict: ai.verdict,
    summary: ai.summary,
    highlights: ai.highlights,
    disclaimer: ai.disclaimer,
    model: ai.model,
    generatedAt: ai.generatedAt,
  };

  writePulseToCache({
    key: cacheKey,
    userKey,
    from: input.from,
    to: input.to,
    dataVersion,
    payload: response,
    nowIso,
  });

  return response;
}
