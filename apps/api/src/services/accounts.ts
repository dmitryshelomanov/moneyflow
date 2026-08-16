import {
  CreateAccountSchema,
  type CreateAccount,
  toMinorUnits,
  type UpdateAccount,
} from "@moneyflow/shared";
import { asc, desc, eq, sql } from "drizzle-orm";
import { AppError } from "../errors.js";
import { newId } from "../auth.js";
import { db } from "../db/client.js";
import { accounts, transactions } from "../db/schema.js";
import { getSettings } from "./settings.js";

const DEFAULT_ACCOUNT_NAME = "Main";

function nowIso() {
  return new Date().toISOString();
}

function normalizeHint(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveOpeningBalance(amount: number, amountInMinor?: boolean) {
  return amountInMinor ? Math.round(amount) : toMinorUnits(amount);
}

export function getAccountById(id: string) {
  return db.select().from(accounts).where(eq(accounts.id, id)).get() ?? null;
}

export function listAccounts() {
  return db
    .select()
    .from(accounts)
    .orderBy(desc(accounts.isDefault), asc(accounts.name))
    .all();
}

export function getTotalOpeningBalance() {
  const row = db
    .select({
      total: sql<number>`coalesce(sum(${accounts.openingBalance}), 0)`,
    })
    .from(accounts)
    .get();
  return Number(row?.total ?? 0);
}

export function getDefaultAccount() {
  const existing =
    db.select().from(accounts).where(eq(accounts.isDefault, true)).get() ??
    null;
  if (existing) return existing;
  return ensureDefaultAccount();
}

export function ensureDefaultAccount() {
  const existingDefault = getAccountById("main");
  if (existingDefault) {
    if (!existingDefault.isDefault) {
      db.update(accounts)
        .set({ isDefault: true })
        .where(eq(accounts.id, existingDefault.id))
        .run();
      return getAccountById(existingDefault.id)!;
    }
    return existingDefault;
  }

  const row = {
    id: "main",
    name: DEFAULT_ACCOUNT_NAME,
    matchHint: "наличные,кэш,cash,основной,main",
    openingBalance: getSettings().openingBalance,
    isDefault: true,
    createdAt: nowIso(),
  };
  db.insert(accounts).values(row).run();
  return row;
}

export function createAccount(input: CreateAccount) {
  const parsed = CreateAccountSchema.parse(input);
  const row = {
    id: newId(),
    name: parsed.name.trim(),
    matchHint: normalizeHint(parsed.matchHint),
    openingBalance: resolveOpeningBalance(
      parsed.openingBalance,
      parsed.openingBalanceInMinor,
    ),
    isDefault: false,
    createdAt: nowIso(),
  };
  db.insert(accounts).values(row).run();
  return row;
}

export function updateAccount(id: string, input: UpdateAccount) {
  const existing = getAccountById(id);
  if (!existing) return null;
  const next = {
    name: input.name?.trim() ?? existing.name,
    matchHint:
      input.matchHint === undefined
        ? existing.matchHint
        : normalizeHint(input.matchHint),
    openingBalance:
      input.openingBalance === undefined
        ? existing.openingBalance
        : resolveOpeningBalance(
            input.openingBalance,
            input.openingBalanceInMinor,
          ),
  };
  db.update(accounts).set(next).where(eq(accounts.id, id)).run();
  return getAccountById(id)!;
}

export function deleteAccount(id: string) {
  const existing = getAccountById(id);
  if (!existing) return false;
  if (existing.isDefault) {
    throw new AppError(400, "Default account cannot be deleted");
  }
  const defaultAccount = getDefaultAccount();
  if (defaultAccount.id !== id) {
    db.update(transactions)
      .set({ accountId: defaultAccount.id })
      .where(eq(transactions.accountId, id))
      .run();
  }
  db.delete(accounts).where(eq(accounts.id, id)).run();
  return true;
}
