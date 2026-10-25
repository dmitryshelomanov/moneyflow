import { and, asc, eq, ne } from "drizzle-orm";
import { Api } from "grammy";
import { formatStartGreeting } from "../bot-messages.js";
import { db } from "../db/client.js";
import { botChatMessages } from "../db/schema.js";
import { env } from "../env.js";
import { log } from "../log.js";
import { getBalance, getSettings } from "./money.js";

export type BotChatMessageKind = "greeting" | "other";

export type ClearChatHistoryTelegram = {
  deleteMessages: (chatId: string, messageIds: number[]) => Promise<void>;
  sendGreeting: (chatId: string, text: string) => Promise<number>;
};

const DELETE_BATCH_SIZE = 100;

export function recordBotChatMessage(input: {
  chatId: string;
  messageId: number;
  kind: BotChatMessageKind;
}): void {
  db.insert(botChatMessages)
    .values({
      chatId: input.chatId,
      messageId: input.messageId,
      kind: input.kind,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();
}

export function hasGreeting(chatId: string): boolean {
  const row = db
    .select({ id: botChatMessages.id })
    .from(botChatMessages)
    .where(
      and(
        eq(botChatMessages.chatId, chatId),
        eq(botChatMessages.kind, "greeting"),
      ),
    )
    .limit(1)
    .get();
  return Boolean(row);
}

export function listBotChatMessages(chatId: string) {
  return db
    .select()
    .from(botChatMessages)
    .where(eq(botChatMessages.chatId, chatId))
    .orderBy(asc(botChatMessages.createdAt), asc(botChatMessages.id))
    .all();
}

function buildStartGreetingText(): string {
  const settings = getSettings();
  const webUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/k/${env.ACCESS_KEY}/`;
  return formatStartGreeting({
    balance: getBalance(),
    currency: settings.currency,
    webUrl,
  });
}

export function createTelegramChatApi(
  token = env.TELEGRAM_BOT_TOKEN,
): ClearChatHistoryTelegram | null {
  if (!token) return null;
  const api = new Api(token);
  return {
    async deleteMessages(chatId, messageIds) {
      await api.deleteMessages(chatId, messageIds);
    },
    async sendGreeting(chatId, text) {
      const message = await api.sendMessage(chatId, text, {
        parse_mode: "HTML",
      });
      return message.message_id;
    },
  };
}

async function deleteMessageBatches(
  telegram: ClearChatHistoryTelegram,
  chatId: string,
  messageIds: number[],
): Promise<void> {
  for (let i = 0; i < messageIds.length; i += DELETE_BATCH_SIZE) {
    const batch = messageIds.slice(i, i + DELETE_BATCH_SIZE);
    try {
      await telegram.deleteMessages(chatId, batch);
    } catch (err) {
      log.warn(
        "bot",
        "deleteMessages batch failed",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function clearChatHistory(
  chatId: string,
  telegram: ClearChatHistoryTelegram,
): Promise<{ deleted: number; keptGreeting: boolean }> {
  const rows = listBotChatMessages(chatId);
  const greeting = rows.find((row) => row.kind === "greeting") ?? null;
  const toDelete = greeting
    ? rows.filter((row) => row.id !== greeting.id)
    : rows;
  const messageIds = toDelete.map((row) => row.messageId);

  if (messageIds.length > 0) {
    await deleteMessageBatches(telegram, chatId, messageIds);
  }

  if (greeting) {
    db.delete(botChatMessages)
      .where(
        and(
          eq(botChatMessages.chatId, chatId),
          ne(botChatMessages.id, greeting.id),
        ),
      )
      .run();
    return { deleted: toDelete.length, keptGreeting: true };
  }

  if (rows.length > 0) {
    db.delete(botChatMessages).where(eq(botChatMessages.chatId, chatId)).run();
  }

  try {
    const messageId = await telegram.sendGreeting(
      chatId,
      buildStartGreetingText(),
    );
    recordBotChatMessage({
      chatId,
      messageId,
      kind: "greeting",
    });
    return { deleted: toDelete.length, keptGreeting: true };
  } catch (err) {
    log.warn(
      "bot",
      "send greeting after clear failed",
      err instanceof Error ? err.message : err,
    );
    return { deleted: toDelete.length, keptGreeting: false };
  }
}
