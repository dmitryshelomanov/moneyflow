import {
  formatMoney,
  type Category,
  type ParseBatch,
  type ParseResult,
} from "@moneyflow/shared";
import type { Transaction } from "@moneyflow/shared";

export class NotATransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotATransactionError";
  }
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatTxReply(opts: {
  title: string;
  parse: ParseResult;
  categoryName?: string | null;
  balance: number;
  currency: string;
  amountMinor: number;
  occurredAt: string;
}): string {
  const isExpense = opts.parse.type === "expense";
  const kind = isExpense ? "Расход" : "Доход";
  const sign = isExpense ? "−" : "+";
  const lines = [
    `<b>${esc(opts.title)}</b>`,
    "",
    `${kind}: <b>${sign}${esc(formatMoney(opts.amountMinor, opts.currency))}</b>`,
  ];
  if (opts.categoryName) {
    lines.push(`Категория: <b>${esc(opts.categoryName)}</b>`);
  }
  if (opts.parse.note) {
    lines.push(`Заметка: ${esc(opts.parse.note)}`);
  }
  lines.push(
    `Дата: ${esc(new Date(opts.occurredAt).toLocaleString("ru-RU"))}`,
    "",
    `Баланс сейчас: <b>${esc(formatMoney(opts.balance, opts.currency))}</b>`,
    `Уверенность: ${Math.round(opts.parse.confidence * 100)}%`,
  );
  return lines.join("\n");
}

export function formatBatchReply(opts: {
  batch: ParseBatch;
  transactions: Transaction[];
  balance: number;
  currency: string;
  findCategory: (categoryId: string | null) => string | null;
}): string {
  const { batch, transactions, balance, currency } = opts;
  const n = transactions.length;

  if (n === 1) {
    const tx = transactions[0]!;
    const parse = batch.transactions[0]!;
    const title =
      batch.kind === "receipt"
        ? "Чек разобран"
        : batch.kind === "list"
          ? "Записал операцию"
          : "Записал";
    return formatTxReply({
      title,
      parse,
      categoryName: opts.findCategory(tx.categoryId),
      balance,
      currency,
      amountMinor: tx.amount,
      occurredAt: tx.occurredAt,
    });
  }

  const title =
    batch.kind === "list"
      ? `Записал ${n} операций со скрина`
      : `Записал ${n} операций`;

  const lines = [`<b>${esc(title)}</b>`, ""];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]!;
    const parse = batch.transactions[i]!;
    const sign = tx.type === "expense" ? "−" : "+";
    const cat = opts.findCategory(tx.categoryId);
    const note = parse.note || "Операция";
    const catSuffix = cat ? ` · ${cat}` : "";
    lines.push(
      `• ${esc(note)}${esc(catSuffix)}: <b>${sign}${esc(formatMoney(tx.amount, currency))}</b>`,
    );
  }

  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const incomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);

  lines.push("");
  if (expenseTotal > 0) {
    lines.push(`Расход: <b>−${esc(formatMoney(expenseTotal, currency))}</b>`);
  }
  if (incomeTotal > 0) {
    lines.push(`Доход: <b>+${esc(formatMoney(incomeTotal, currency))}</b>`);
  }
  lines.push(`Баланс сейчас: <b>${esc(formatMoney(balance, currency))}</b>`);

  return lines.join("\n");
}

export function formatErrorReply(err: unknown): string {
  if (err instanceof NotATransactionError) {
    return [
      "<b>Это не похоже на трату или чек</b>",
      "",
      esc(err.message),
      "",
      "Пришли, например:",
      "• <code>кофе 350</code>",
      "• <code>продукты 2400</code>",
      "• фото чека или скрин списка трат из банка",
    ].join("\n");
  }

  const raw = err instanceof Error ? err.message : String(err);
  // Zod dumps JSON arrays — never show that to the user
  if (raw.trimStart().startsWith("[") || raw.trimStart().startsWith("{")) {
    return [
      "<b>Не понял операцию</b>",
      "",
      "Не вышло вытащить сумму или тип (доход/расход).",
      "Напиши текстом вроде <code>такси 450</code> или кинь фото чека / скрин банка.",
    ].join("\n");
  }

  if (/ROUTERAI|API|fetch|network|timeout/i.test(raw)) {
    return [
      "<b>Сервис разбора временно недоступен</b>",
      "",
      "Попробуй ещё раз через минуту.",
    ].join("\n");
  }

  return [
    "<b>Не удалось разобрать</b>",
    "",
    esc(raw.slice(0, 280)),
    "",
    "Попробуй иначе: короткий текст с суммой, фото чека или скрин истории банка.",
  ].join("\n");
}

export function findCategoryName(
  cats: Category[],
  categoryId: string | null,
): string | null {
  if (!categoryId) return null;
  return cats.find((c) => c.id === categoryId)?.name ?? null;
}
