import {
  FinancePulseVerdictSchema,
  ParseBatchSchema,
  ParseRejectSchema,
  ParseResultSchema,
  SavingsAdviceTipSchema,
  type FinancePulseResponse,
  type FinancePulseVerdict,
  type SavingsAdviceImpact,
  type SavingsAdviceResponse,
  type ParseBatch,
  type ParseResult,
} from "@moneyflow/shared";
import OpenAI from "openai";
import { ZodError, z } from "zod";
import { NotATransactionError } from "../bot-messages.js";
import { env } from "../env.js";
import { log } from "../log.js";
import { listCategories } from "./categories.js";
import { getSettings } from "./settings.js";

type ParseInputOptions = {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
};

type CsvImportInput = {
  headers: string[];
  rows: Array<Record<string, string>>;
  chunkIndex: number;
  promptExtension?: string;
};

const UNKNOWN_MODEL_RESPONSE = "Модель вернула непонятный ответ";
const NO_TRANSACTION_MESSAGE =
  "Не вижу сумму или тип операции. Это больше похоже на случайное сообщение, чем на трату.";
const DEFAULT_IMAGE_PROMPT =
  "Разбери фото: список операций банка, чек магазина или одна платёжка. Верни JSON. Если не финансовое — ok:false.";
const TEXT_FALLBACK_HELP =
  "Не смог разобрать сообщение. Пришли сумму текстом или фото чека.";
const IMAGE_FALLBACK_HELP =
  "На фото не видно чека или списка трат. Пришли квитанцию, скрин банка или напиши текстом.";
const ADVICE_DISCLAIMER =
  "Советы носят ориентировочный характер и не являются финансовой консультацией.";
const AI_TIMEOUT_MS = 30_000;

function getAiModel() {
  return getSettings().aiModel || env.ROUTERAI_MODEL;
}

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name =
    "name" in error ? String((error as { name?: unknown }).name) : "";
  if (name === "AbortError" || name === "TimeoutError") return true;
  const message =
    "message" in error ? String((error as { message?: unknown }).message) : "";
  return /aborted|timeout|timed out/i.test(message);
}

function normalizeAiTransportError(error: unknown): never {
  if (isAbortLikeError(error)) {
    throw new Error("AI request timed out");
  }
  throw error;
}

async function createJsonCompletion(input: {
  client: OpenAI;
  model: string;
  temperature: number;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}) {
  return input.client.chat.completions
    .create(
      {
        model: input.model,
        temperature: input.temperature,
        messages: input.messages,
        response_format: { type: "json_object" },
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    )
    .catch(normalizeAiTransportError);
}

function getClient() {
  if (!env.ROUTERAI_API_KEY) {
    throw new Error("ROUTERAI_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey: env.ROUTERAI_API_KEY,
    baseURL: env.ROUTERAI_BASE_URL,
  });
}

function buildSystemPrompt(): string {
  const s = getSettings();
  const cats = listCategories();
  const catLines = cats
    .map(
      (c) =>
        `- "${c.name}" icon=${c.icon}${c.prompt ? ` prompt="${c.prompt}"` : ""}`,
    )
    .join("\n");

  return `Ты парсер финансовых операций для личного учёта денег.
Верни ТОЛЬКО валидный JSON без markdown.

Если это НЕ финансовая операция, НЕ чек и НЕ список трат банка
(селфи, мем, случайное фото, бессмысленный текст без суммы) — верни:
{
  "ok": false,
  "reason": "коротко по-русски, почему нельзя записать (1 предложение, можно с лёгким юмором)"
}

Если нашёл деньги — верни:
{
  "ok": true,
  "kind": "single" | "receipt" | "list",
  "transactions": [ { ...одна или несколько операций... } ]
}

Каждая операция:
{
  "type": "expense" | "income",
  "amount": number (основные единицы валюты, например 350.5; ВСЕГДА > 0),
  "currency": string,
  "occurredAt": ISO-8601 datetime,
  "note": string,
  "categoryName": string | null,
  "createCategory": { "name": string, "icon": LucideIconName } | null,
  "confidence": number 0..1
}

Как выбрать kind:
1) "list" — скриншот истории операций банка/приложения (Тинькофф, Сбер, Альфа и т.п.):
   несколько строк «мерчант + категория + сумма».
   Каждая видимая операция = отдельный элемент transactions.
   НЕ суммируй день. НЕ записывай итог дня/месяца отдельной операцией.
   Игнорируй кешбэк/баллы вроде «+4», «+10» рядом с именем — это не сумма.
   note = название мерчанта/получателя (как на экране).
   Категорию банка («Супермаркеты», «Такси») мапь на наши категории.
   Дату бери из заголовка секции («8 августа»); год — из сегодняшней даты, если года нет.
   Знак «−» / красная сумма → expense; «+» / пополнение → income.
   amount без минуса: «−499,99 ₽» → 499.99; «−1 072 ₽» → 1072.
2) "receipt" — ТОЛЬКО если уверен, что это чек/квитанция магазина
   (позиции товаров + итог к оплате, фискальный чек, QR и т.п.):
   ОДНА операция с итоговой суммой оплаты (не сумма позиций по отдельности).
   note = магазин или краткое описание.
3) "single" — одна трата/доход текстом или одно платежное уведомление.

Правила общие:
- Валюта по умолчанию: ${s.currency}
- Сегодня (UTC): ${new Date().toISOString()}
- Если пользователь пишет относительную дату («вчера»), вычисли occurredAt.
- Выбери существующую категорию по имени, если подходит.
- Если подходящей нет — заполни createCategory (короткое русское имя + Lucide icon name в PascalCase).
- categoryName должен совпадать с существующей или с createCategory.name.
- Не выдумывай сумму, если её нет на фото/в тексте — верни ok:false.
- Если на скрине видны и список, и итог — запиши только строки списка (kind=list).
- Сомневаешься чек это или список: если несколько независимых сумм у разных мерчантов → list;
  если один магазин и позиции с итогом → receipt.

Глобальные правила категоризации от пользователя:
${s.categorizationPrompt || "(нет)"}

Существующие категории:
${catLines || "(пока пусто — создай подходящую)"}
`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new NotATransactionError(UNKNOWN_MODEL_RESPONSE);
    return JSON.parse(match[0]);
  }
}

function normalizeModelPayload(raw: unknown): unknown {
  if (typeof raw !== "object" || !raw || !("ok" in raw)) {
    return raw;
  }

  const { ok: _ok, ...rest } = raw as Record<string, unknown>;
  return rest;
}

function normalizeItem(raw: unknown): ParseResult {
  const obj = normalizeModelPayload(raw);

  const parsed = ParseResultSchema.safeParse(obj);
  if (!parsed.success) {
    log.debug("ai", "item schema mismatch", parsed.error.flatten());
    throw new NotATransactionError(NO_TRANSACTION_MESSAGE);
  }
  return parsed.data;
}

function deriveBatchKind(
  rawKind: unknown,
  itemsCount: number,
  fallback: ParseBatch["kind"],
): ParseBatch["kind"] {
  const kindParse = ParseBatchSchema.shape.kind.safeParse(rawKind);
  if (kindParse.success) return kindParse.data;
  if (itemsCount > 1) return "list";
  return fallback;
}

function interpretParseJson(json: unknown): ParseBatch {
  const rejected = ParseRejectSchema.safeParse(json);
  if (rejected.success) {
    throw new NotATransactionError(rejected.data.reason);
  }

  if (typeof json !== "object" || !json) {
    throw new NotATransactionError(UNKNOWN_MODEL_RESPONSE);
  }

  const record = json as Record<string, unknown>;

  // New batch shape: { ok?, kind, transactions: [...] }
  if (Array.isArray(record.transactions)) {
    const items = record.transactions.map(normalizeItem);
    if (items.length === 0) {
      throw new NotATransactionError(NO_TRANSACTION_MESSAGE);
    }
    const kind = deriveBatchKind(record.kind, items.length, "single");
    return ParseBatchSchema.parse({ kind, transactions: items });
  }

  // Legacy single-op shape: { type, amount, ... }
  if ("amount" in record && "type" in record) {
    const item = normalizeItem(record);
    const kind = deriveBatchKind(record.kind, 1, "single");
    return { kind, transactions: [item] };
  }

  throw new NotATransactionError(NO_TRANSACTION_MESSAGE);
}

function buildUserContent(
  opts: ParseInputOptions,
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  if (opts.text?.trim()) {
    userContent.push({ type: "text", text: opts.text.trim() });
  } else {
    userContent.push({
      type: "text",
      text: DEFAULT_IMAGE_PROMPT,
    });
  }

  if (opts.imageBase64) {
    const mime = opts.imageMime ?? "image/jpeg";
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${mime};base64,${opts.imageBase64}`,
      },
    });
  }

  return userContent;
}

function buildCsvImportSystemPrompt(promptExtension?: string): string {
  const s = getSettings();
  const cats = listCategories();
  const catLines = cats
    .map(
      (c) =>
        `- "${c.name}" icon=${c.icon}${c.prompt ? ` prompt="${c.prompt}"` : ""}`,
    )
    .join("\n");

  return `Ты импортируешь CSV в формат финансовых транзакций.
Верни ТОЛЬКО валидный JSON без markdown.

Требуется формат:
{
  "kind": "list",
  "transactions": [
    {
      "type": "expense" | "income",
      "amount": number (> 0, основные единицы валюты),
      "currency": string,
      "occurredAt": ISO-8601 datetime,
      "note": string,
      "categoryName": string | null,
      "createCategory": { "name": string, "icon": LucideIconName } | null,
      "confidence": number 0..1
    }
  ]
}

Правила:
- Обрабатывай каждую строку CSV как максимум одну транзакцию.
- Пропускай строки, которые не являются движением денег.
- Не выдумывай суммы и даты; если данных нет — пропусти строку.
- amount всегда положительный. type определяет расход/доход.
- Валюта по умолчанию: ${s.currency}
- Категории выбирай из существующих. Если подходящей нет, укажи createCategory.
- categoryName должен быть либо существующей категорией, либо createCategory.name.
- note делай коротким и полезным (мерчант/описание операции).
- kind всегда "list".

Глобальные правила категоризации от пользователя:
${s.categorizationPrompt || "(нет)"}

Существующие категории:
${catLines || "(пока пусто — создай подходящую)"}

Дополнительная подсказка пользователя для текущего импорта:
${promptExtension?.trim() || "(нет)"}
`;
}

const AdviceModelSchema = z.object({
  tips: z.array(SavingsAdviceTipSchema).max(10),
  disclaimer: z.string().min(1).optional(),
});
const AdviceRawTipSchema = SavingsAdviceTipSchema.extend({
  factIds: z.array(z.string().min(1)).min(1).max(3),
});
const AdviceRawModelSchema = z.object({
  tips: z.array(AdviceRawTipSchema).max(10),
  disclaimer: z.string().min(1).optional(),
});

type SavingsAdviceInput = {
  from: string;
  to: string;
  currency: string;
  maxTips: number;
  periodIncome: number;
  periodExpense: number;
  balance: number;
  previousIncome: number;
  previousExpense: number;
  topCategories: Array<{
    categoryName: string;
    total: number;
    sharePct: number;
  }>;
  recurringSpends: Array<{
    key: string;
    total: number;
    count: number;
    avgAmount: number;
  }>;
  categoryGrowth: Array<{
    categoryName: string;
    total: number;
    previousTotal: number;
    delta: number;
    deltaPct: number | null;
  }>;
  largeExpenses: Array<{
    occurredAt: string;
    note: string;
    categoryName: string;
    amount: number;
  }>;
  notePatterns: Array<{
    label: string;
    total: number;
    count: number;
  }>;
  recentExpenses: Array<{
    occurredAt: string;
    note: string;
    categoryName: string;
    amount: number;
  }>;
  preparedFacts: string[];
  dailyAverageExpense: number;
  peakSpendHour: number | null;
  peakSpendWeekday: number | null;
};

function impactRank(value: SavingsAdviceImpact) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function formatMajor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function extractMoneyTokens(text: string): string[] {
  const matches = text.match(/\d[\d\s]*,\d{2}\s*₽/g);
  if (!matches) return [];
  return matches.map((token) => token.replace(/\s+/g, " ").trim());
}

function parseRubTokenToMinor(token: string): number | null {
  const cleaned = token.replace(/[^\d,]/g, "").replace(/\s+/g, "");
  if (!cleaned.includes(",")) return null;
  const normalized = cleaned.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function buildAdviceDetailsFromFacts(facts: string[]) {
  const items = facts.map((fact) => `<li>${fact}</li>`).join("");
  return `<p>Подтверждено данными за период:</p><ul>${items}</ul>`;
}

function buildAdviceSystemPrompt(currency: string, maxTips: number): string {
  return `Ты финансовый ассистент для личного бюджета.
Верни ТОЛЬКО JSON без markdown.
Задача: предложить до ${maxTips} практичных способов снизить расходы.
Пиши по-русски и коротко.

Строгий формат:
{
  "tips": [
    {
      "title": "короткий заголовок",
      "rationale": "2-3 коротких предложения с объяснением на основе данных",
      "detailsHtml": "<p>Короткая деталь.</p><ul><li>Пункт с цифрой</li></ul>",
      "category": "название категории или null",
      "impact": "low" | "medium" | "high",
      "estimatedSaving": number | null,
      "estimatedSavingFormatted": "12 500,00 ₽ или null",
      "factIds": ["F1", "F7"]
    }
  ],
  "disclaimer": "необязательно"
}

Правила:
- Не придумывай категории, которых нет в данных.
- Если нет достаточных данных, верни пустой массив tips.
- estimatedSaving указывай в минорных единицах валюты ${currency} (например копейки), либо null.
- Каждый совет ОБЯЗАН опираться на конкретные факты из операций: повторяемость, рост категории, крупные единичные траты или паттерн заметок.
- Для каждого совета укажи 1-3 factIds из блока preparedFacts.
- Используй в объяснениях ТОЛЬКО цифры из выбранных factIds, не пересчитывай и не придумывай новые суммы.
- В rationale укажи минимум 1 числовой аргумент (процент, сумма, частота).
- Числа в rationale и detailsHtml пиши в человекочитаемом формате: "1 234 567,89 ₽", не "1234567.89".
- detailsHtml верни валидным HTML с тегами только: <p>, <ul>, <li>, <strong>, <em>, <br>.
- Избегай шаблонных фраз вроде "просто покупайте по списку" без привязки к данным.
- Не повторяй советы про одну и ту же причину разными словами.
- Советы должны быть конкретными и применимыми в быту.
- Не давай медицинских/юридических/инвестиционных рекомендаций.`;
}

export async function generateSavingsAdvice(
  input: SavingsAdviceInput,
): Promise<SavingsAdviceResponse> {
  const client = getClient();
  const model = getAiModel();
  const started = Date.now();

  log.debug("ai", "savings advice start", {
    model,
    period: `${input.from}..${input.to}`,
    maxTips: input.maxTips,
  });

  const preparedFacts = input.preparedFacts.map((text, index) => ({
    id: `F${index + 1}`,
    text,
  }));
  const factById = new Map(preparedFacts.map((item) => [item.id, item.text]));

  const completion = await createJsonCompletion({
    client,
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: buildAdviceSystemPrompt(input.currency, input.maxTips),
      },
      {
        role: "user",
        content: JSON.stringify({
          period: { from: input.from, to: input.to },
          metrics: {
            currency: input.currency,
            income: input.periodIncome,
            expense: input.periodExpense,
            balance: input.balance,
            previousIncome: input.previousIncome,
            previousExpense: input.previousExpense,
            dailyAverageExpense: input.dailyAverageExpense,
          },
          spendingPatterns: {
            topCategories: input.topCategories,
            peakSpendHour: input.peakSpendHour,
            peakSpendWeekday: input.peakSpendWeekday,
            recurringSpends: input.recurringSpends,
            categoryGrowth: input.categoryGrowth,
            largeExpenses: input.largeExpenses,
            notePatterns: input.notePatterns,
            recentExpenses: input.recentExpenses,
          },
          preparedFacts,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от модели");
  }

  const json = extractJson(content);
  const parsed = AdviceRawModelSchema.parse(json);
  const normalizedTips = parsed.tips.slice(0, input.maxTips).map((tip) => {
    const linkedFacts = tip.factIds
      .map((id) => factById.get(id))
      .filter((value): value is string => Boolean(value));
    if (linkedFacts.length === 0) return null;

    const allowedMoneyTokens = new Set(
      linkedFacts.flatMap((fact) => extractMoneyTokens(fact)),
    );
    const tipText = `${tip.rationale}\n${tip.detailsHtml ?? ""}`;
    const tipMoneyTokens = extractMoneyTokens(tipText);
    const hasUnverifiedMoney = tipMoneyTokens.some(
      (token) => !allowedMoneyTokens.has(token),
    );
    if (hasUnverifiedMoney) {
      log.debug("ai", "tip dropped: unverified money token", {
        title: tip.title,
        tipMoneyTokens,
        allowedMoneyTokens: [...allowedMoneyTokens],
      });
      return null;
    }

    const allowedSavingsMinor = new Set(
      [...allowedMoneyTokens]
        .map(parseRubTokenToMinor)
        .filter((value): value is number => value != null),
    );
    let estimatedSaving = tip.estimatedSaving;
    if (
      estimatedSaving != null &&
      (!allowedSavingsMinor.has(estimatedSaving) ||
        estimatedSaving > input.periodExpense)
    ) {
      estimatedSaving = null;
    }

    return {
      title: tip.title,
      rationale: tip.rationale,
      detailsHtml: buildAdviceDetailsFromFacts(linkedFacts),
      category: tip.category,
      impact: tip.impact,
      estimatedSaving,
      estimatedSavingFormatted:
        estimatedSaving == null
          ? null
          : formatMajor(estimatedSaving, input.currency),
    };
  });
  const tips = normalizedTips
    .filter(
      (tip): tip is Exclude<(typeof normalizedTips)[number], null> =>
        tip !== null,
    )
    .sort((a, b) => impactRank(b.impact) - impactRank(a.impact));
  const safeTips = AdviceModelSchema.shape.tips.parse(tips);

  const response: SavingsAdviceResponse = {
    period: { from: input.from, to: input.to },
    currency: input.currency,
    tips: safeTips,
    disclaimer: parsed.disclaimer ?? ADVICE_DISCLAIMER,
    model,
    generatedAt: new Date().toISOString(),
  };

  log.debug("ai", "savings advice ok", {
    ms: Date.now() - started,
    tips: response.tips.length,
    usage: completion.usage,
  });

  return response;
}

const PULSE_DISCLAIMER =
  "Оценка ориентировочная и не является финансовой консультацией.";

const PulseRawModelSchema = z.object({
  verdict: FinancePulseVerdictSchema,
  summary: z.string().min(1).max(2200),
  highlights: z.array(z.string().min(1).max(280)).max(6).optional(),
  disclaimer: z.string().min(1).optional(),
});

type FinancePulseCategoryInput = {
  categoryName: string;
  type: "expense" | "income";
  total: number;
  sharePct: number;
  previousTotal: number;
  delta: number;
  deltaPct: number | null;
};

type FinancePulseInput = {
  from: string;
  to: string;
  currency: string;
  periodIncome: number;
  periodExpense: number;
  periodNet: number;
  balance: number;
  expenseRatioPct: number | null;
  previousIncome: number;
  previousExpense: number;
  previousNet: number;
  incomeDelta: number;
  expenseDelta: number;
  dailyAverageExpense: number;
  topExpenseCategories: FinancePulseCategoryInput[];
  topIncomeCategories: FinancePulseCategoryInput[];
  growingCategories: FinancePulseCategoryInput[];
};

function buildPulseSystemPrompt(currency: string): string {
  return `Ты дружелюбный финансовый ассистент для личного бюджета.
Верни ТОЛЬКО JSON без markdown.
Пиши по-русски, тёплым человеческим тоном — без нравоучений и паники.
Не давай медицинских, юридических и инвестиционных рекомендаций.

Задача: по цифрам периода и категориям сказать, как дела с деньгами — нормально, туго или плохо.
Обязательно опирайся на категории расходов/доходов: что тянет бюджет, что выросло, что выглядит ок.

Строгий формат:
{
  "verdict": "ok" | "tight" | "bad",
  "summary": "3–6 предложений по-русски",
  "highlights": ["2–5 коротких пунктов про категории и динамику"],
  "disclaimer": "опционально"
}

Ориентиры для verdict:
- "ok" — доход покрывает расход с запасом и/или баланс выглядит устойчиво («нормально»).
- "tight" — около нуля или лёгкий минус, но не катастрофа («пройдёт»).
- "bad" — заметный перерасход и/или баланс на исходе («плохо»).

Правила:
- Выбери ровно один verdict.
- В summary и highlights опирайся только на переданные цифры и категории; не выдумывай суммы и названия.
- Упомяни минимум 1–2 ключевые категории расходов (и доходные, если они есть).
- Если есть growingCategories — скажи, что выросло и насколько это заметно.
- Сравни с прошлым периодом, если дельты содержательны.
- Деньги в тексте пиши в формате "1 234 567,89 ₽" (валюта: ${currency}).
- Не читай морали; коротко объясни, почему так, и чем это ощущается.
- Можно мягко поддержать, если цифры грустные — без токсичного позитива.
- highlights: короткие фразы (не повторяй дословно весь summary).`;
}

export async function generateFinancePulse(
  input: FinancePulseInput,
): Promise<
  Pick<
    FinancePulseResponse,
    | "verdict"
    | "summary"
    | "highlights"
    | "disclaimer"
    | "model"
    | "generatedAt"
  >
> {
  const client = getClient();
  const model = getAiModel();
  const started = Date.now();

  log.debug("ai", "finance pulse start", {
    model,
    period: `${input.from}..${input.to}`,
    expenseCategories: input.topExpenseCategories.length,
  });

  const mapCategory = (item: FinancePulseCategoryInput) => ({
    ...item,
    totalFormatted: formatMajor(item.total, input.currency),
    previousTotalFormatted: formatMajor(item.previousTotal, input.currency),
    deltaFormatted: formatMajor(item.delta, input.currency),
  });

  const completion = await createJsonCompletion({
    client,
    model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: buildPulseSystemPrompt(input.currency),
      },
      {
        role: "user",
        content: JSON.stringify({
          period: { from: input.from, to: input.to },
          metrics: {
            currency: input.currency,
            income: input.periodIncome,
            expense: input.periodExpense,
            net: input.periodNet,
            balance: input.balance,
            expenseRatioPct: input.expenseRatioPct,
            previousIncome: input.previousIncome,
            previousExpense: input.previousExpense,
            previousNet: input.previousNet,
            incomeDelta: input.incomeDelta,
            expenseDelta: input.expenseDelta,
            dailyAverageExpense: input.dailyAverageExpense,
            incomeFormatted: formatMajor(input.periodIncome, input.currency),
            expenseFormatted: formatMajor(input.periodExpense, input.currency),
            netFormatted: formatMajor(input.periodNet, input.currency),
            balanceFormatted: formatMajor(input.balance, input.currency),
            previousIncomeFormatted: formatMajor(
              input.previousIncome,
              input.currency,
            ),
            previousExpenseFormatted: formatMajor(
              input.previousExpense,
              input.currency,
            ),
            incomeDeltaFormatted: formatMajor(
              input.incomeDelta,
              input.currency,
            ),
            expenseDeltaFormatted: formatMajor(
              input.expenseDelta,
              input.currency,
            ),
            dailyAverageExpenseFormatted: formatMajor(
              input.dailyAverageExpense,
              input.currency,
            ),
          },
          topExpenseCategories: input.topExpenseCategories.map(mapCategory),
          topIncomeCategories: input.topIncomeCategories.map(mapCategory),
          growingCategories: input.growingCategories.map(mapCategory),
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от модели");
  }

  const json = extractJson(content);
  const parsed = PulseRawModelSchema.parse(json);
  const verdict: FinancePulseVerdict = parsed.verdict;
  const highlights = (parsed.highlights ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

  log.debug("ai", "finance pulse ok", {
    ms: Date.now() - started,
    verdict,
    highlights: highlights.length,
    usage: completion.usage,
  });

  return {
    verdict,
    summary: parsed.summary.trim(),
    highlights,
    disclaimer: parsed.disclaimer ?? PULSE_DISCLAIMER,
    model,
    generatedAt: new Date().toISOString(),
  };
}

export async function parseTransactionInput(
  opts: ParseInputOptions,
): Promise<ParseBatch> {
  const client = getClient();
  const model = getAiModel();
  const userContent = buildUserContent(opts);
  const started = Date.now();

  log.debug("ai", "parse start", {
    model,
    hasText: Boolean(opts.text?.trim()),
    hasImage: Boolean(opts.imageBase64),
    textPreview: opts.text?.trim().slice(0, 120),
    imageBytes: opts.imageBase64
      ? Math.round((opts.imageBase64.length * 3) / 4)
      : 0,
  });

  const completion = await createJsonCompletion({
    client,
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new NotATransactionError("Пустой ответ от модели");
  const json = extractJson(content);
  const parsed = interpretParseJson(json);
  log.debug("ai", "parse ok", {
    ms: Date.now() - started,
    kind: parsed.kind,
    count: parsed.transactions.length,
    amounts: parsed.transactions.map((t) => t.amount),
    usage: completion.usage,
  });
  return parsed;
}

/** Fallback local parser when AI is unavailable (dev / offline). */
export function parseTransactionLocal(text: string): ParseBatch {
  log.debug("ai", "local fallback parse", { textPreview: text.slice(0, 120) });
  const s = getSettings();
  const lower = text.toLowerCase();
  const amountMatch = text.replace(",", ".").match(/(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) {
    throw new NotATransactionError(
      "В тексте нет суммы. Напиши, например: «кофе 350».",
    );
  }
  const amount = Number(amountMatch[1]);
  const isIncome =
    /зарплат|доход|получил|перевод мне|фриланс|аванс|income/.test(lower) ||
    /^[+]/.test(text.trim());

  let occurredAt = new Date();
  if (/вчера/.test(lower)) {
    occurredAt = new Date(Date.now() - 86400000);
  }

  const note =
    text.replace(amountMatch[0], "").trim() || (isIncome ? "Доход" : "Трата");

  return {
    kind: "single",
    transactions: [
      {
        type: isIncome ? "income" : "expense",
        amount,
        currency: s.currency,
        occurredAt: occurredAt.toISOString(),
        note,
        categoryName: null,
        createCategory: {
          name: isIncome ? "Доход" : "Прочее",
          icon: isIncome ? "Wallet" : "Circle",
        },
        confidence: 0.4,
      },
    ],
  };
}

function fallbackToLocalTextParse(
  opts: ParseInputOptions,
  originalError: unknown,
) {
  if (!opts.text) return null;

  try {
    return parseTransactionLocal(opts.text);
  } catch (localErr) {
    if (localErr instanceof NotATransactionError) throw localErr;
    if (originalError instanceof ZodError) {
      throw new NotATransactionError(TEXT_FALLBACK_HELP);
    }
    throw originalError;
  }
}

export async function parseSmart(opts: ParseInputOptions): Promise<ParseBatch> {
  if (env.ROUTERAI_API_KEY) {
    try {
      return await parseTransactionInput(opts);
    } catch (err) {
      if (err instanceof NotATransactionError) throw err;
      log.error(
        "ai",
        "parse failed, falling back",
        err instanceof Error ? err.message : err,
      );

      const localParsed = fallbackToLocalTextParse(opts, err);
      if (localParsed) {
        return localParsed;
      }

      if (err instanceof ZodError) {
        throw new NotATransactionError(IMAGE_FALLBACK_HELP);
      }
      throw err;
    }
  }
  log.warn("ai", "ROUTERAI_API_KEY missing, using local parser");
  if (opts.text) return parseTransactionLocal(opts.text);
  throw new NotATransactionError(
    "Для разбора фото нужен ROUTERAI_API_KEY. Пока можешь писать текстом.",
  );
}

export async function parseCsvRowsWithAi(
  input: CsvImportInput,
): Promise<ParseBatch> {
  const client = getClient();
  const model = getAiModel();
  const started = Date.now();

  log.debug("ai", "csv import parse start", {
    model,
    chunkIndex: input.chunkIndex,
    headers: input.headers.length,
    rows: input.rows.length,
  });

  const completion = await createJsonCompletion({
    client,
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: buildCsvImportSystemPrompt(input.promptExtension),
      },
      {
        role: "user",
        content: JSON.stringify({
          chunkIndex: input.chunkIndex,
          headers: input.headers,
          rows: input.rows,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от модели при импорте CSV");
  }

  const json = extractJson(content);
  const parsed = interpretParseJson(json);
  log.debug("ai", "csv import parse ok", {
    ms: Date.now() - started,
    chunkIndex: input.chunkIndex,
    count: parsed.transactions.length,
    usage: completion.usage,
  });
  return parsed;
}
