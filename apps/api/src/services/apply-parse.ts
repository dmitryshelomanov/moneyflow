import {
  TRANSACTION_NOTE_MAX_LENGTH,
  type ParseBatch,
  type ParseResult,
  type Transaction,
} from "@moneyflow/shared";
import { sqlite } from "../db/client.js";
import {
  getAccountById,
  getDefaultAccount,
  listAccounts,
  createCategory,
  createTransaction,
  findCategoryByName,
  getBalance,
  getSettings,
} from "./money.js";

function resolveCategoryId(parsed: ParseResult): string | null {
  if (parsed.categoryName) {
    const existing = findCategoryByName(parsed.categoryName);
    if (existing) return existing.id;
    if (parsed.createCategory) {
      const created = createCategory({
        name: parsed.createCategory.name,
        icon: parsed.createCategory.icon ?? "Circle",
        prompt: null,
      });
      return created.id;
    }
    const created = createCategory({
      name: parsed.categoryName,
      icon: "Circle",
      prompt: null,
    });
    return created.id;
  }

  if (parsed.createCategory) {
    const existing = findCategoryByName(parsed.createCategory.name);
    if (existing) return existing.id;
    const created = createCategory({
      name: parsed.createCategory.name,
      icon: parsed.createCategory.icon ?? "Circle",
      prompt: null,
    });
    return created.id;
  }

  return null;
}

type AccountResolution = {
  accountId: string;
  accountName: string;
  needsReview: boolean;
  source: "user" | "ai" | "default";
  hint: string | null;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreAccountMatch(
  account: { name: string; matchHint: string | null },
  hint: string,
) {
  const accountName = normalizeText(account.name);
  if (accountName === hint) return 100;
  if (accountName.includes(hint) || hint.includes(accountName)) return 90;

  const hintTokens = hint.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const aliasTokens = (account.matchHint ?? "")
    .split(/[,\n;]+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
  let score = 0;
  for (const token of hintTokens) {
    if (token.length < 2) continue;
    if (aliasTokens.includes(token)) score = Math.max(score, 80);
    else if (
      aliasTokens.some(
        (alias) => alias.includes(token) || token.includes(alias),
      )
    ) {
      score = Math.max(score, 70);
    }
    if (accountName.includes(token)) score = Math.max(score, 65);
  }
  return score;
}

function resolveAccount(
  parsed: ParseResult,
  preferredAccountId?: string | null,
): AccountResolution {
  const defaultAccount = getDefaultAccount();
  const preferredId = preferredAccountId?.trim();
  if (preferredId) {
    const preferred = getAccountById(preferredId);
    if (preferred) {
      return {
        accountId: preferred.id,
        accountName: preferred.name,
        needsReview: false,
        source: "user",
        hint: parsed.accountHint?.trim() ?? null,
      };
    }
  }

  const hintRaw = parsed.accountHint?.trim() ?? "";
  if (!hintRaw) {
    return {
      accountId: defaultAccount.id,
      accountName: defaultAccount.name,
      needsReview: true,
      source: "default",
      hint: null,
    };
  }

  const hint = normalizeText(hintRaw);
  const scored = listAccounts()
    .map((account) => ({
      account,
      score: scoreAccountMatch(account, hint),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const hasTie = Boolean(best && scored[1] && scored[1].score === best.score);
  if (!best || hasTie) {
    return {
      accountId: defaultAccount.id,
      accountName: defaultAccount.name,
      needsReview: true,
      source: "default",
      hint: hintRaw,
    };
  }

  return {
    accountId: best.account.id,
    accountName: best.account.name,
    needsReview: (parsed.accountConfidence ?? 0.7) < 0.6,
    source: "ai",
    hint: hintRaw,
  };
}

export function applyParseResult(
  parsed: ParseResult,
  opts: {
    source: "telegram" | "web";
    rawText?: string | null;
    preferredAccountId?: string | null;
  },
) {
  const s = getSettings();
  const categoryId = resolveCategoryId(parsed);
  const accountResolution = resolveAccount(parsed, opts.preferredAccountId);

  const tx = createTransaction({
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency ?? s.currency,
    accountId: accountResolution.accountId,
    categoryId,
    occurredAt: parsed.occurredAt,
    note: parsed.note.slice(0, TRANSACTION_NOTE_MAX_LENGTH),
    source: opts.source,
    rawText: opts.rawText ?? null,
  });

  return {
    transaction: tx,
    balance: getBalance(),
    settings: s,
    parse: parsed,
    accountResolution,
  };
}

export function applyParseBatch(
  batch: ParseBatch,
  opts: {
    source: "telegram" | "web";
    rawText?: string | null;
    preferredAccountId?: string | null;
  },
) {
  const runAtomic = sqlite.transaction(() => {
    const s = getSettings();
    const saved: Transaction[] = [];
    const parses: ParseResult[] = [];
    const accountResolutions: AccountResolution[] = [];

    for (const item of batch.transactions) {
      const result = applyParseResult(item, opts);
      saved.push(result.transaction);
      parses.push(result.parse);
      accountResolutions.push(result.accountResolution);
    }

    return {
      kind: batch.kind,
      transactions: saved,
      /** First saved tx — convenience for single/receipt clients. */
      transaction: saved[0]!,
      balance: getBalance(),
      settings: s,
      parse: parses[0]!,
      parses,
      accountResolution: accountResolutions[0]!,
      accountResolutions,
    };
  });

  return runAtomic();
}
