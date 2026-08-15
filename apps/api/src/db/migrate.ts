import { count } from "drizzle-orm";
import { env } from "../env.js";
import { db, sqlite } from "./client.js";
import { settings } from "./schema.js";
import {
  DEFAULT_CATEGORIZATION_PROMPT,
  seedBaseCategories,
} from "./seed-categories.js";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL DEFAULT 'RUB',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  categorization_prompt TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT 'openai/gpt-4o',
  allowed_telegram_ids TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  icon TEXT NOT NULL DEFAULT 'Circle',
  prompt TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL CHECK(source IN ('telegram', 'web')),
  raw_text TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
`;

function ensureSettingsColumns() {
  const cols = sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("allowed_telegram_ids")) {
    sqlite.exec(
      "ALTER TABLE settings ADD COLUMN allowed_telegram_ids TEXT NOT NULL DEFAULT ''",
    );
  }
}

export function migrate() {
  sqlite.exec(MIGRATION_SQL);
  ensureSettingsColumns();

  const [{ value }] = db.select({ value: count() }).from(settings).all();
  if (value === 0) {
    db.insert(settings)
      .values({
        currency: "RUB",
        openingBalance: 0,
        categorizationPrompt: DEFAULT_CATEGORIZATION_PROMPT,
        aiModel: env.ROUTERAI_MODEL,
        allowedTelegramIds: "",
      })
      .run();
  }

  seedBaseCategories();
}
