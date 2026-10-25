import { formatMoney, type ParseBatch } from "@moneyflow/shared";
import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard, type Context } from "grammy";
import {
  findCategoryName,
  formatBatchReply,
  formatErrorReply,
  formatStartGreeting,
} from "./bot-messages.js";
import { env } from "./env.js";
import { isTelegramAllowed } from "./telegram-acl.js";
import { log } from "./log.js";
import { consumeRateLimit } from "./server/middleware/rate-limit.js";
import { isSafeTelegramFilePath } from "./telegram-file.js";
import { parseSmart } from "./services/ai.js";
import { applyParseBatch } from "./services/apply-parse.js";
import {
  hasGreeting,
  recordBotChatMessage,
  type BotChatMessageKind,
} from "./services/bot-chat-history.js";
import {
  deleteTransaction,
  getBalance,
  getSettings,
  listCategories,
} from "./services/money.js";

const html = { parse_mode: "HTML" as const };
const BOT_AI_WINDOW_MS = 60 * 60 * 1000;
const BOT_AI_MAX_REQUESTS = 40;
const MAX_TELEGRAM_PHOTO_BYTES = 8 * 1024 * 1024;

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

function allowBotAi(userId: number): boolean {
  return consumeRateLimit(
    `bot-ai:tg:${userId}`,
    BOT_AI_WINDOW_MS,
    BOT_AI_MAX_REQUESTS,
  ).allowed;
}

async function downloadTelegramPhoto(filePath: string): Promise<Buffer> {
  if (!isSafeTelegramFilePath(filePath)) {
    throw new Error("Unsafe telegram file path");
  }

  const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    throw new Error("Failed to download photo");
  }
  if (!response.ok || !response.body) {
    throw new Error("Failed to download photo");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_TELEGRAM_PHOTO_BYTES) {
        throw new Error("Photo is too large");
      }
      chunks.push(value);
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    if (err instanceof Error && err.message === "Photo is too large") throw err;
    throw new Error("Failed to download photo");
  }

  return Buffer.concat(chunks);
}

function photoFailureReply(err: unknown): string | null {
  const message = err instanceof Error ? err.message : "";
  if (message === "Photo is too large") {
    return "Фото слишком большое. Пришли снимок поменьше или напиши текстом.";
  }
  if (
    message === "Failed to download photo" ||
    message === "Unsafe telegram file path"
  ) {
    return "Не удалось скачать фото. Пришли его ещё раз или напиши текстом.";
  }
  return null;
}

function chatIdOf(ctx: Context): string | null {
  if (ctx.chat?.id == null) return null;
  return String(ctx.chat.id);
}

function trackOutbound(
  ctx: Context,
  messageId: number,
  kind: BotChatMessageKind = "other",
) {
  const chatId = chatIdOf(ctx);
  if (!chatId) return;
  recordBotChatMessage({ chatId, messageId, kind });
}

async function trackedReply(
  ctx: Context,
  text: string,
  other?: Parameters<Context["reply"]>[1],
  kind: BotChatMessageKind = "other",
) {
  const msg = await ctx.reply(text, other);
  trackOutbound(ctx, msg.message_id, kind);
  return msg;
}

function buildStartGreetingText(): string {
  const s = getSettings();
  const balance = getBalance();
  const webUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/k/${env.ACCESS_KEY}/`;
  return formatStartGreeting({
    balance,
    currency: s.currency,
    webUrl,
  });
}

async function replyWithSavedBatch(
  ctx: Context,
  batch: ParseBatch,
  result: SavedBatch,
) {
  const cats = listCategories();
  const kb = buildUndoKeyboard(result.transactions);
  await trackedReply(
    ctx,
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
    if (ctx.chat?.type !== "private") return;
    await next();
  });

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

  bot.use(async (ctx, next) => {
    if (ctx.message && ctx.chat) {
      recordBotChatMessage({
        chatId: String(ctx.chat.id),
        messageId: ctx.message.message_id,
        kind: "other",
      });
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    log.debug("bot", "/start", { userId: ctx.from?.id });
    const chatId = chatIdOf(ctx);
    const kind: BotChatMessageKind =
      chatId && hasGreeting(chatId) ? "other" : "greeting";
    await trackedReply(ctx, buildStartGreetingText(), html, kind);
  });

  bot.command("balance", async (ctx) => {
    const s = getSettings();
    const balance = getBalance();
    log.debug("bot", "/balance", { userId: ctx.from?.id, balance });
    await trackedReply(
      ctx,
      `Баланс: <b>${formatMoney(balance, s.currency)}</b>`,
      html,
    );
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
    await trackedReply(
      ctx,
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

    const userId = ctx.from?.id;

    if (!userId || !allowBotAi(userId)) {
      await trackedReply(ctx, "Слишком много запросов. Попробуй позже.", html);
      return;
    }

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
      await trackedReply(ctx, formatErrorReply(err), html);
    }
  });

  bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id;

    if (!userId || !allowBotAi(userId)) {
      await trackedReply(ctx, "Слишком много запросов. Попробуй позже.", html);
      return;
    }

    log.info("bot", "photo message", {
      userId,
      caption: ctx.message.caption?.slice(0, 80),
    });
    await ctx.replyWithChatAction("typing");
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    let buffer: Buffer | null = null;

    try {
      const file = await ctx.api.getFile(best.file_id);
      if (!file.file_path) throw new Error("Failed to download photo");
      buffer = await downloadTelegramPhoto(file.file_path);
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
      const safeReply = photoFailureReply(err);
      log.error(
        "bot",
        "photo parse failed",
        safeReply
          ? "photo download failed"
          : err instanceof Error
            ? err.message
            : err,
      );
      await trackedReply(ctx, safeReply ?? formatErrorReply(err), html);
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
