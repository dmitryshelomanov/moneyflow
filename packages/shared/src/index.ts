import { z } from "zod";

export const TransactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TRANSACTION_NOTE_MAX_LENGTH = 1000;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  icon: z.string().min(1),
  prompt: z.string().nullable(),
  createdAt: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).default("Circle"),
  prompt: z.string().max(2000).nullable().optional(),
});
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  matchHint: z.string().nullable(),
  openingBalance: z.number().int(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  matchHint: z.string().max(200).nullable().optional(),
  openingBalance: z.number().optional().default(0),
  openingBalanceInMinor: z.boolean().optional(),
});
export type CreateAccount = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = CreateAccountSchema.partial();
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: z.number().int(),
  currency: z.string(),
  accountId: z.string().nullable(),
  categoryId: z.string().nullable(),
  occurredAt: z.string(),
  note: z.string().nullable(),
  source: z.enum(["telegram", "web"]),
  rawText: z.string().nullable(),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionsPageSchema = z.object({
  items: z.array(TransactionSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type TransactionsPage = z.infer<typeof TransactionsPageSchema>;

export const CreateTransactionSchema = z.object({
  type: TransactionTypeSchema,
  amount: z.number().positive(),
  currency: z.string().min(1).optional(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  note: z.string().max(TRANSACTION_NOTE_MAX_LENGTH).nullable().optional(),
  source: z.enum(["telegram", "web"]).default("web"),
  rawText: z.string().nullable().optional(),
  /** If true, amount is already in minor units (kopecks). */
  amountInMinor: z.boolean().optional(),
});
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;

export const UpdateTransactionSchema = z.object({
  type: TransactionTypeSchema.optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  note: z.string().max(TRANSACTION_NOTE_MAX_LENGTH).nullable().optional(),
  amountInMinor: z.boolean().optional(),
});
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;

export const SettingsSchema = z.object({
  currency: z.string().min(1),
  openingBalance: z.number().int(),
  categorizationPrompt: z.string(),
  aiModel: z.string(),
  allowedTelegramIds: z.string(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = z.object({
  currency: z.string().min(1).optional(),
  openingBalance: z.number().optional(),
  openingBalanceInMinor: z.boolean().optional(),
  categorizationPrompt: z.string().max(8000).optional(),
  allowedTelegramIds: z.string().max(500).optional(),
});
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

export const ParseResultSchema = z.object({
  type: TransactionTypeSchema,
  amount: z.number().positive(),
  currency: z.string().min(1).optional(),
  occurredAt: z.string(),
  note: z.string(),
  accountHint: z.string().max(160).nullable().optional(),
  accountConfidence: z.number().min(0).max(1).optional(),
  categoryName: z.string().nullable(),
  createCategory: z
    .object({
      name: z.string().min(1),
      icon: z.string().optional(),
    })
    .nullable()
    .optional(),
  confidence: z.number().min(0).max(1),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

/** How the input was classified by the parser. */
export const ParseKindSchema = z.enum(["single", "receipt", "list"]);
export type ParseKind = z.infer<typeof ParseKindSchema>;

/** One or more operations from text / photo / bank screenshot. */
export const ParseBatchSchema = z.object({
  kind: ParseKindSchema,
  transactions: z.array(ParseResultSchema).min(1),
});
export type ParseBatch = z.infer<typeof ParseBatchSchema>;

/** AI rejected input (not a receipt / no money op). */
export const ParseRejectSchema = z.object({
  ok: z.literal(false),
  reason: z.string().min(1),
});
export type ParseReject = z.infer<typeof ParseRejectSchema>;

export const ParseResponseSchema = z.union([
  ParseRejectSchema,
  ParseBatchSchema.extend({ ok: z.literal(true).optional() }),
  ParseResultSchema.extend({ ok: z.literal(true).optional() }),
]);
export type ParseResponse = z.infer<typeof ParseResponseSchema>;

export const ParseRequestSchema = z
  .object({
    text: z.string().max(10_000).optional(),
    imageBase64: z.string().max(5_000_000).optional(),
    imageMime: z.string().max(120).optional(),
    accountId: z.string().nullable().optional(),
    save: z.boolean().optional().default(true),
  })
  .refine((value) => Boolean(value.text || value.imageBase64), {
    message: "text or imageBase64 required",
  });
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

export const ImportCsvAiRequestSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  filename: z.string().max(255).optional(),
  promptExtension: z.string().max(4_000).optional(),
});
export type ImportCsvAiRequest = z.infer<typeof ImportCsvAiRequestSchema>;

export const ImportCsvAiResponseSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  parsed: z.number().int().nonnegative(),
  saved: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.string().min(1)),
});
export type ImportCsvAiResponse = z.infer<typeof ImportCsvAiResponseSchema>;

const DateInputSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Invalid date",
  });
const StatsGranularitySchema = z.enum(["day", "week", "month", "year"]);

export const StatsRangeQuerySchema = z.object({
  from: DateInputSchema,
  to: DateInputSchema,
  accountId: z.string().min(1).optional(),
});
export type StatsRangeQuery = z.infer<typeof StatsRangeQuerySchema>;

export const StatsSummaryQuerySchema = z.object({
  from: DateInputSchema.optional(),
  to: DateInputSchema.optional(),
  accountId: z.string().min(1).optional(),
});
export type StatsSummaryQuery = z.infer<typeof StatsSummaryQuerySchema>;

export const StatsTimeseriesQuerySchema = StatsRangeQuerySchema.extend({
  granularity: StatsGranularitySchema.optional().default("day"),
});
export type StatsTimeseriesQuery = z.infer<typeof StatsTimeseriesQuerySchema>;

export const StatsBalanceSeriesQuerySchema = StatsRangeQuerySchema.extend({
  granularity: StatsGranularitySchema.optional().default("month"),
});
export type StatsBalanceSeriesQuery = z.infer<
  typeof StatsBalanceSeriesQuerySchema
>;

export const StatsCategoryParetoQuerySchema = StatsRangeQuerySchema.extend({
  type: TransactionTypeSchema.optional().default("expense"),
});
export type StatsCategoryParetoQuery = z.infer<
  typeof StatsCategoryParetoQuerySchema
>;

export const StatsSpendingHeatmapQuerySchema = StatsRangeQuerySchema.extend({
  type: TransactionTypeSchema.optional().default("expense"),
});
export type StatsSpendingHeatmapQuery = z.infer<
  typeof StatsSpendingHeatmapQuerySchema
>;

export const TransactionsListQuerySchema = z.object({
  from: DateInputSchema.optional(),
  to: DateInputSchema.optional(),
  type: TransactionTypeSchema.optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().min(1).optional(),
});
export type TransactionsListQuery = z.infer<typeof TransactionsListQuerySchema>;

export const StatsSummarySchema = z.object({
  currency: z.string(),
  balance: z.number().int(),
  periodIncome: z.number().int(),
  periodExpense: z.number().int(),
  byCategory: z.array(
    z.object({
      categoryId: z.string().nullable(),
      categoryName: z.string(),
      icon: z.string().nullable(),
      type: TransactionTypeSchema,
      total: z.number().int(),
    }),
  ),
});
export type StatsSummary = z.infer<typeof StatsSummarySchema>;

export const TimeseriesPointSchema = z.object({
  date: z.string(),
  income: z.number().int(),
  expense: z.number().int(),
});
export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;

export const BalancePointSchema = z.object({
  date: z.string(),
  balance: z.number().int(),
});
export type BalancePoint = z.infer<typeof BalancePointSchema>;

export const SavingsAdviceImpactSchema = z.enum(["low", "medium", "high"]);
export type SavingsAdviceImpact = z.infer<typeof SavingsAdviceImpactSchema>;

export const SavingsAdviceRequestSchema = z.object({
  from: DateInputSchema,
  to: DateInputSchema,
  maxTips: z.number().int().min(1).max(10).optional(),
});
export type SavingsAdviceRequest = z.infer<typeof SavingsAdviceRequestSchema>;

export const SavingsAdviceTipSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  detailsHtml: z.string().min(1).optional(),
  category: z.string().nullable(),
  impact: SavingsAdviceImpactSchema,
  estimatedSaving: z.number().int().nonnegative().nullable(),
  estimatedSavingFormatted: z.string().nullable().optional(),
});
export type SavingsAdviceTip = z.infer<typeof SavingsAdviceTipSchema>;

export const SavingsAdviceResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  currency: z.string(),
  tips: z.array(SavingsAdviceTipSchema),
  disclaimer: z.string(),
  model: z.string(),
  generatedAt: z.string(),
});
export type SavingsAdviceResponse = z.infer<typeof SavingsAdviceResponseSchema>;

export const FinancePulseVerdictSchema = z.enum(["ok", "tight", "bad"]);
export type FinancePulseVerdict = z.infer<typeof FinancePulseVerdictSchema>;

export const FinancePulseRequestSchema = z.object({
  from: DateInputSchema,
  to: DateInputSchema,
});
export type FinancePulseRequest = z.infer<typeof FinancePulseRequestSchema>;

export const FinancePulseCategorySchema = z.object({
  categoryName: z.string(),
  type: TransactionTypeSchema,
  total: z.number().int(),
  sharePct: z.number(),
  previousTotal: z.number().int(),
  delta: z.number().int(),
  deltaPct: z.number().nullable(),
});
export type FinancePulseCategory = z.infer<typeof FinancePulseCategorySchema>;

export const FinancePulseMetricsSchema = z.object({
  periodIncome: z.number().int(),
  periodExpense: z.number().int(),
  periodNet: z.number().int(),
  balance: z.number().int(),
  expenseRatioPct: z.number().nullable(),
  previousIncome: z.number().int(),
  previousExpense: z.number().int(),
  previousNet: z.number().int(),
  incomeDelta: z.number().int(),
  expenseDelta: z.number().int(),
  dailyAverageExpense: z.number().int(),
});
export type FinancePulseMetrics = z.infer<typeof FinancePulseMetricsSchema>;

export const FinancePulseResponseSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  currency: z.string(),
  metrics: FinancePulseMetricsSchema,
  topExpenseCategories: z.array(FinancePulseCategorySchema),
  topIncomeCategories: z.array(FinancePulseCategorySchema),
  growingCategories: z.array(FinancePulseCategorySchema),
  verdict: FinancePulseVerdictSchema,
  summary: z.string().min(1),
  highlights: z.array(z.string().min(1)).max(6),
  disclaimer: z.string(),
  model: z.string(),
  generatedAt: z.string(),
});
export type FinancePulseResponse = z.infer<typeof FinancePulseResponseSchema>;

export const TelegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
});
export type TelegramAuth = z.infer<typeof TelegramAuthSchema>;

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

export function formatMoney(amountMinor: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(amountMinor));
}
