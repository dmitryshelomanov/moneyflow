import { z } from "zod";

export const TransactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: TransactionTypeSchema,
  icon: z.string().min(1),
  prompt: z.string().nullable(),
  createdAt: z.string(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  type: TransactionTypeSchema,
  icon: z.string().min(1).default("Circle"),
  prompt: z.string().max(2000).nullable().optional(),
});
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: z.number().int(),
  currency: z.string(),
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
  categoryId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  note: z.string().max(500).nullable().optional(),
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
  categoryId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  note: z.string().max(500).nullable().optional(),
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
  categoryName: z.string().nullable(),
  createCategory: z
    .object({
      name: z.string().min(1),
      type: TransactionTypeSchema,
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
  from: z.string().min(1),
  to: z.string().min(1),
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
  from: z.string().min(1),
  to: z.string().min(1),
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
