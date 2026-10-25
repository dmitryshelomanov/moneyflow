import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  currency: text("currency").notNull().default("RUB"),
  openingBalance: integer("opening_balance").notNull().default(0),
  categorizationPrompt: text("categorization_prompt").notNull().default(""),
  aiModel: text("ai_model").notNull().default("openai/gpt-4o"),
  allowedTelegramIds: text("allowed_telegram_ids").notNull().default(""),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("Circle"),
  prompt: text("prompt"),
  createdAt: text("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  matchHint: text("match_hint"),
  openingBalance: integer("opening_balance").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["expense", "income"] }).notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  occurredAt: text("occurred_at").notNull(),
  note: text("note"),
  source: text("source", { enum: ["telegram", "web"] }).notNull(),
  rawText: text("raw_text"),
  createdAt: text("created_at").notNull(),
});

export const adviceCache = sqliteTable("advice_cache", {
  key: text("key").primaryKey(),
  userKey: text("user_key").notNull(),
  from: text("from_ymd").notNull(),
  to: text("to_ymd").notNull(),
  maxTips: integer("max_tips").notNull(),
  dataVersion: text("data_version").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const botChatMessages = sqliteTable(
  "bot_chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    messageId: integer("message_id").notNull(),
    kind: text("kind", { enum: ["greeting", "other"] }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    chatMessageUnique: uniqueIndex("idx_bot_chat_messages_chat_message").on(
      table.chatId,
      table.messageId,
    ),
    chatIdIdx: index("idx_bot_chat_messages_chat_id").on(table.chatId),
  }),
);

export type SettingsRow = typeof settings.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type AdviceCacheRow = typeof adviceCache.$inferSelect;
export type BotChatMessageRow = typeof botChatMessages.$inferSelect;
