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
  icon TEXT NOT NULL DEFAULT 'Circle',
  prompt TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  match_hint TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
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

function ensureAccountsColumns() {
  const cols = sqlite.prepare("PRAGMA table_info(accounts)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("match_hint")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN match_hint TEXT");
  }
  if (!names.has("is_default")) {
    sqlite.exec(
      "ALTER TABLE accounts ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!names.has("opening_balance")) {
    sqlite.exec(
      "ALTER TABLE accounts ADD COLUMN opening_balance INTEGER NOT NULL DEFAULT 0",
    );
  }
}

function ensureTransactionsColumns() {
  const cols = sqlite
    .prepare("PRAGMA table_info(transactions)")
    .all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("account_id")) {
    sqlite.exec(
      "ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL",
    );
  }
  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)",
  );
}

export function migrate() {
  sqlite.exec(MIGRATION_SQL);
  ensureSettingsColumns();

  const [{ value: settingsCount }] = db
    .select({ value: count() })
    .from(settings)
    .all();
  if (settingsCount === 0) {
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

  ensureAccountsColumns();
  ensureTransactionsColumns();

  const currentSettings = db.select().from(settings).limit(1).get();
  const openingBalance = currentSettings?.openingBalance ?? 0;

  const defaultAccount = sqlite
    .prepare("SELECT id FROM accounts WHERE is_default = 1 LIMIT 1")
    .get() as { id: string } | undefined;

  let defaultAccountId = defaultAccount?.id;
  if (!defaultAccountId) {
    const mainById = sqlite
      .prepare("SELECT id FROM accounts WHERE id = ? LIMIT 1")
      .get("main") as { id: string } | undefined;
    if (mainById) {
      sqlite
        .prepare("UPDATE accounts SET is_default = 1 WHERE id = ?")
        .run("main");
      defaultAccountId = "main";
    } else {
      defaultAccountId = "main";
      sqlite
        .prepare(
          "INSERT INTO accounts (id, name, match_hint, opening_balance, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          defaultAccountId,
          "Main",
          "наличные,кэш,cash,основной,main",
          openingBalance,
          1,
          new Date().toISOString(),
        );
    }
  }

  sqlite
    .prepare("UPDATE transactions SET account_id = ? WHERE account_id IS NULL")
    .run(defaultAccountId);

  seedBaseCategories();
}

const isDirectRun = process.argv[1]?.includes("migrate");
if (isDirectRun) {
  migrate();
}
