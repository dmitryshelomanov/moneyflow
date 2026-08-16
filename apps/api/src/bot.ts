import { formatMoney, type ParseBatch } from "@moneyflow/shared";
import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard } from "grammy";
import {
  findCategoryName,
  formatBatchReply,
  formatErrorReply,
} from "./bot-messages.js";
import { env } from "./env.js";
import { isTelegramAllowed } from "./telegram-acl.js";
import { log } from "./log.js";
import { parseSmart } from "./services/ai.js";
import { applyParseBatch } from "./services/apply-parse.js";
import {
  deleteTransaction,
  getBalance,
  getSettings,
  listCategories,
} from "./services/money.js";

const html = { parse_mode: "HTML" as const };

type SavedBatch = ReturnType<typeof applyParseBatch>;

/** Short-lived undo batches for multi-tx screenshots (callback_data is tiny). */
const undoBatches = new Map<string, { ids: string[]; expiresAt: number }>();

function registerUndoBatch(ids: string[]): string {
  const key = randomBytes(6).toString("hex");
  undoBatches.set(key, {
    ids,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
  // Opportunistic cleanup
  if (undoBatches.size > 200) {
    const now = Date.now();
    for (const [k, v] of undoBatches) {
      if (v.expiresAt < now) undoBatches.delete(k);
    }
  }
  return key;
}

function consumeUndoBatch(key: string): string[] | null {
  const entry = undoBatches.get(key);
  if (!entry) return null;
  undoBatches.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry.ids;
}

function buildUndoKeyboard(transactionsToUndo: SavedBatch["transactions"]) {
  const kb = new InlineKeyboard();
  if (transactionsToUndo.length === 1) {
    kb.text("Отменить", `undo:${transactionsToUndo[0]!.id}`);
    return kb;
  }

  const key = registerUndoBatch(transactionsToUndo.map((t) => t.id));
  kb.text("Отменить все", `undobatch:${key}`);
  return kb;
}

function inferPhotoRawText(
  caption: string | undefined,
  kind: ParseBatch["kind"],
): string {
  if (caption) return caption;
  if (kind === "list") return "[bank list screenshot]";
  if (kind === "receipt") return "[receipt photo]";
  return "[photo]";
}

function logSavedTransactions(
  message: "transactions saved" | "photo saved",
  result: SavedBatch,
  userId: number | undefined,
) {
  log.info("bot", message, {
    kind: result.kind,
    count: result.transactions.length,
    ids: result.transactions.map((t) => t.id),
    balance: result.balance,
    userId,
  });
}

async function replyWithSavedBatch(
  ctx: { reply: (...args: any[]) => Promise<unknown> },
  batch: ParseBatch,
  result: SavedBatch,
) {
  const cats = listCategories();
  const kb = buildUndoKeyboard(result.transactions);
  await ctx.reply(
    formatBatchReply({
      batch,
      transactions: result.transactions,
      balance: result.balance,
      currency: result.settings.currency,
      findCategory: (id) => findCategoryName(cats, id),
    }),
    { ...html, reply_markup: kb },
  );
}

export function createBot() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    log.warn("bot", "TELEGRAM_BOT_TOKEN not set — bot disabled");
    return null;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id || !isTelegramAllowed(id)) {
      log.warn("bot", "rejected user", { id, username: ctx.from?.username });
      if (ctx.message) {
        await ctx.reply("Доступ закрыт.", html);
      }
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    log.debug("bot", "/start", { userId: ctx.from?.id });
    const s = getSettings();
    const balance = getBalance();
    const webUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/k/${env.ACCESS_KEY}/`;
    await ctx.reply(
      [
        "<b>MoneyFlow</b> — личный учёт денег",
        "",
        `Баланс: <b>${formatMoney(balance, s.currency)}</b>`,
        `Валюта: ${s.currency}`,
        "",
        "<b>Как писать</b>",
        "• расход — <code>кофе 350</code>, <code>продукты вчера 2400</code>",
        "• доход — <code>зарплата 120000</code>",
        "• фото чека — одна запись с итогом",
        "• скрин списка трат из банка — каждая операция отдельно",
        "",
        "<b>Команды</b>",
        "/balance — текущий баланс",
        "/today — доходы и расходы за сегодня",
        "",
        "После записи можно нажать «Отменить».",
        "",
        `Веб: ${webUrl}`,
      ].join("\n"),
      html,
    );
  });

  bot.command("balance", async (ctx) => {
    const s = getSettings();
    const balance = getBalance();
    log.debug("bot", "/balance", { userId: ctx.from?.id, balance });
    await ctx.reply(`Баланс: <b>${formatMoney(balance, s.currency)}</b>`, html);
  });

  bot.command("today", async (ctx) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { getSummary } = await import("./services/money.js");
    const summary = getSummary(start.toISOString());
    const s = getSettings();
    log.debug("bot", "/today", {
      userId: ctx.from?.id,
      income: summary.periodIncome,
      expense: summary.periodExpense,
    });
    await ctx.reply(
      [
        "<b>Сегодня</b>",
        `Доход: <b>${formatMoney(summary.periodIncome, s.currency)}</b>`,
        `Расход: <b>${formatMoney(summary.periodExpense, s.currency)}</b>`,
        `Баланс: <b>${formatMoney(summary.balance, s.currency)}</b>`,
      ].join("\n"),
      html,
    );
  });

  bot.callbackQuery(/^undo:(.+)$/, async (ctx) => {
    const id = ctx.match![1];
    const ok = deleteTransaction(id);
    log.debug("bot", "undo", { transactionId: id, ok, userId: ctx.from?.id });
    await ctx.answerCallbackQuery({ text: ok ? "Отменено" : "Уже удалено" });
    if (ok) {
      const s = getSettings();
      await ctx.editMessageText(
        [
          "<b>Операция отменена</b>",
          `Баланс: <b>${formatMoney(getBalance(), s.currency)}</b>`,
        ].join("\n"),
        html,
      );
    }
  });

  bot.callbackQuery(/^undobatch:(.+)$/, async (ctx) => {
    const key = ctx.match![1];
    const ids = consumeUndoBatch(key);
    if (!ids) {
      await ctx.answerCallbackQuery({ text: "Уже удалено или устарело" });
      return;
    }
    let deleted = 0;
    for (const id of ids) {
      if (deleteTransaction(id)) deleted += 1;
    }
    log.debug("bot", "undo batch", {
      key,
      deleted,
      total: ids.length,
      userId: ctx.from?.id,
    });
    await ctx.answerCallbackQuery({
      text: deleted ? `Отменено: ${deleted}` : "Уже удалено",
    });
    const s = getSettings();
    await ctx.editMessageText(
      [
        `<b>Отменено операций: ${deleted}</b>`,
        `Баланс: <b>${formatMoney(getBalance(), s.currency)}</b>`,
      ].join("\n"),
      html,
    );
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;

    log.info("bot", "text message", {
      userId: ctx.from?.id,
      textPreview: text.slice(0, 120),
    });
    await ctx.replyWithChatAction("typing");
    try {
      const batch = await parseSmart({ text });
      const result = applyParseBatch(batch, {
        source: "telegram",
        rawText: text,
      });
      logSavedTransactions("transactions saved", result, ctx.from?.id);
      await replyWithSavedBatch(ctx, batch, result);
    } catch (err) {
      log.error(
        "bot",
        "text parse failed",
        err instanceof Error ? err.message : err,
      );
      await ctx.reply(formatErrorReply(err), html);
    }
  });

  bot.on("message:photo", async (ctx) => {
    log.info("bot", "photo message", {
      userId: ctx.from?.id,
      caption: ctx.message.caption?.slice(0, 80),
    });
    await ctx.replyWithChatAction("typing");
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    let buffer: Buffer | null = null;

    try {
      const file = await ctx.api.getFile(best.file_id);
      if (!file.file_path) throw new Error("No file path");
      const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error("Failed to download photo");
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
      log.debug("bot", "photo downloaded", { bytes: buffer.length });
      const base64 = buffer.toString("base64");
      const caption = ctx.message.caption ?? undefined;

      const batch = await parseSmart({
        text: caption,
        imageBase64: base64,
        imageMime: "image/jpeg",
      });
      const rawText = inferPhotoRawText(caption, batch.kind);
      const result = applyParseBatch(batch, {
        source: "telegram",
        rawText,
      });
      logSavedTransactions("photo saved", result, ctx.from?.id);
      await replyWithSavedBatch(ctx, batch, result);
    } catch (err) {
      log.error(
        "bot",
        "photo parse failed",
        err instanceof Error ? err.message : err,
      );
      await ctx.reply(formatErrorReply(err), html);
    } finally {
      buffer = null;
      log.debug("bot", "photo buffer cleared");
    }
  });

  return bot;
}

export async function startBot() {
  const bot = createBot();
  if (!bot) return null;
  bot.start({
    onStart: (info) => log.info("bot", `started @${info.username} (polling)`),
  });
  return bot;
}
