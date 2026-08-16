import {
  type Settings,
  type UpdateSettings,
  toMinorUnits,
} from "@moneyflow/shared";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings, transactions } from "../db/schema.js";

export function getSettings(): Settings {
  const row = db.select().from(settings).limit(1).all()[0];
  if (!row) {
    throw new Error("Settings not initialized");
  }
  return {
    currency: row.currency,
    openingBalance: row.openingBalance,
    categorizationPrompt: row.categorizationPrompt,
    aiModel: row.aiModel,
    allowedTelegramIds: row.allowedTelegramIds,
  };
}

export function updateSettings(input: UpdateSettings): Settings {
  const current = getSettings();
  const openingBalance =
    input.openingBalance === undefined
      ? current.openingBalance
      : input.openingBalanceInMinor
        ? Math.round(input.openingBalance)
        : toMinorUnits(input.openingBalance);

  db.update(settings)
    .set({
      currency: input.currency ?? current.currency,
      openingBalance,
      categorizationPrompt:
        input.categorizationPrompt ?? current.categorizationPrompt,
      allowedTelegramIds:
        input.allowedTelegramIds ?? current.allowedTelegramIds,
    })
    .run();

  return getSettings();
}

export function getStatsMeta(accountId?: string) {
  const row = db
    .select({
      firstTransactionAt: sql<string | null>`min(${transactions.occurredAt})`,
    })
    .from(transactions)
    .where(accountId ? eq(transactions.accountId, accountId) : undefined)
    .get();
  return {
    firstTransactionAt: row?.firstTransactionAt ?? null,
  };
}
