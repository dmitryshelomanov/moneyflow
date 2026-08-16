import fs from "node:fs";
import path from "node:path";
import {
  createCategory,
  createTransaction,
  findCategoryByName,
} from "../services/money.js";
import { sqlite } from "./client.js";

type TxType = "expense" | "income";

type ImportStats = {
  totalRows: number;
  imported: number;
  skippedStatus: number;
  skippedOwnTransfers: number;
  skippedBrokerTransfers: number;
  skippedIncomeNotAllowed: number;
  recategorizedMortgage: number;
  skippedInvalidAmount: number;
  skippedInvalidDate: number;
  skippedZeroAmount: number;
  categoriesCreated: number;
};

const DEFAULT_CSV_PATH =
  "/Users/dmitry/Downloads/Operations Mon Aug 01 2022-Sat Aug 15 2026.csv";

const COL_STATUS = "Статус";
const COL_AMOUNT = "Сумма операции";
const COL_CURRENCY = "Валюта операции";
const COL_CATEGORY = "Категория";
const COL_DESCRIPTION = "Описание";
const COL_MCC = "MCC";
const COL_CARD = "Номер карты";
const COL_OPERATION_DATE = "Дата операции";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ";" && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]!);
  const rows: Array<Record<string, string>> = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]!] = values[i] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDateTime(raw: string): string | null {
  const value = raw.trim();
  const match =
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      value,
    );
  if (!match) return null;

  const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = match;
  const year = Number(yyyy);
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(min);
  const second = Number(ss);

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function buildNote(row: Record<string, string>): string | null {
  const description = row[COL_DESCRIPTION]?.trim();
  const mcc = row[COL_MCC]?.trim();
  const card = row[COL_CARD]?.trim();

  const parts = [
    description,
    mcc ? `MCC:${mcc}` : "",
    card ? `Card:${card}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
    .trim();

  if (!parts) return null;
  return parts.slice(0, 500);
}

function normalizeCategoryName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, " ");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOwnAccountsTransfer(row: Record<string, string>): boolean {
  const category = normalizeText(row[COL_CATEGORY] ?? "");
  const description = normalizeText(row[COL_DESCRIPTION] ?? "");
  if (description.includes("между своими счетами")) return true;
  if (category !== "переводы") return false;
  return description.includes("своими счетами");
}

function isBrokerOrDepositTransfer(row: Record<string, string>): boolean {
  const category = normalizeText(row[COL_CATEGORY] ?? "");
  if (category !== "переводы") return false;
  const description = normalizeText(row[COL_DESCRIPTION] ?? "");
  return (
    description.includes("брокер") ||
    description.includes("брокерского счета") ||
    description.includes("вклада") ||
    description.includes("вклад")
  );
}

function isAllowedIncome(
  row: Record<string, string>,
  normalizedCategory: string,
): boolean {
  if (
    normalizedCategory === "зарплата" ||
    normalizedCategory === "проценты" ||
    normalizedCategory === "пополнения" ||
    normalizedCategory === "пополнение"
  ) {
    return true;
  }

  if (normalizedCategory === "переводы") {
    return !isOwnAccountsTransfer(row);
  }

  const description = normalizeText(row[COL_DESCRIPTION] ?? "");
  return description.includes("заработная плата");
}

function shouldRecategorizeToMortgage(
  row: Record<string, string>,
  type: TxType,
  normalizedCategory: string,
): boolean {
  if (type !== "expense" || normalizedCategory !== "переводы") return false;
  const description = normalizeText(row[COL_DESCRIPTION] ?? "");
  return (
    description.includes("shelomanov") ||
    description.includes("шеломанов") ||
    description === "дмитрий ш." ||
    description === "dmitrii sh."
  );
}

function categoryKey(name: string): string {
  return name.toLowerCase();
}

function resolveCategoryId(
  categoryName: string | null,
  cache: Map<string, string>,
  stats: ImportStats,
): string | null {
  if (!categoryName) return null;
  const key = categoryKey(categoryName);
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = findCategoryByName(categoryName);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const created = createCategory({
    name: categoryName,
    icon: "Circle",
    prompt: null,
  });
  cache.set(key, created.id);
  stats.categoriesCreated += 1;
  return created.id;
}

export function importBankCsv(
  csvPath: string,
  options: { clearAll?: boolean } = {},
) {
  const absolutePath = path.resolve(csvPath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const rows = parseCsv(content);

  const stats: ImportStats = {
    totalRows: rows.length,
    imported: 0,
    skippedStatus: 0,
    skippedOwnTransfers: 0,
    skippedBrokerTransfers: 0,
    skippedIncomeNotAllowed: 0,
    recategorizedMortgage: 0,
    skippedInvalidAmount: 0,
    skippedInvalidDate: 0,
    skippedZeroAmount: 0,
    categoriesCreated: 0,
  };

  const cache = new Map<string, string>();
  const clearExisting = options.clearAll ?? true;

  if (clearExisting) {
    sqlite.exec("DELETE FROM transactions;");
  }

  for (const row of rows) {
    const status = row[COL_STATUS]?.trim().toUpperCase();
    if (status !== "OK") {
      stats.skippedStatus += 1;
      continue;
    }
    if (isOwnAccountsTransfer(row)) {
      stats.skippedOwnTransfers += 1;
      continue;
    }
    if (isBrokerOrDepositTransfer(row)) {
      stats.skippedBrokerTransfers += 1;
      continue;
    }

    const amountRaw = row[COL_AMOUNT] ?? "";
    const parsedAmount = parseAmount(amountRaw);
    if (parsedAmount === null) {
      stats.skippedInvalidAmount += 1;
      continue;
    }
    if (parsedAmount === 0) {
      stats.skippedZeroAmount += 1;
      continue;
    }

    const occurredAt = parseDateTime(row[COL_OPERATION_DATE] ?? "");
    if (!occurredAt) {
      stats.skippedInvalidDate += 1;
      continue;
    }

    const type: TxType = parsedAmount < 0 ? "expense" : "income";
    const amount = Math.abs(parsedAmount);
    let categoryName = normalizeCategoryName(row[COL_CATEGORY] ?? "");
    const normalizedCategory = normalizeText(categoryName ?? "");

    if (type === "income" && !isAllowedIncome(row, normalizedCategory)) {
      stats.skippedIncomeNotAllowed += 1;
      continue;
    }

    if (shouldRecategorizeToMortgage(row, type, normalizedCategory)) {
      categoryName = "Ипотека";
      stats.recategorizedMortgage += 1;
    }

    const categoryId = resolveCategoryId(categoryName, cache, stats);
    const note = buildNote(row);

    createTransaction({
      type,
      amount,
      currency: (row[COL_CURRENCY] || "RUB").trim() || "RUB",
      categoryId,
      occurredAt,
      note,
      source: "web",
      rawText: JSON.stringify(row),
    });

    stats.imported += 1;
  }

  return stats;
}

const isDirectRun = process.argv[1]?.includes("import-bank-csv");
if (isDirectRun) {
  const csvPath = process.argv[2] ?? DEFAULT_CSV_PATH;
  const stats = importBankCsv(csvPath);

  console.log(`CSV: ${path.resolve(csvPath)}`);
  console.log(`totalRows=${stats.totalRows}`);
  console.log(`imported=${stats.imported}`);
  console.log(`skippedStatus=${stats.skippedStatus}`);
  console.log(`skippedOwnTransfers=${stats.skippedOwnTransfers}`);
  console.log(`skippedBrokerTransfers=${stats.skippedBrokerTransfers}`);
  console.log(`skippedIncomeNotAllowed=${stats.skippedIncomeNotAllowed}`);
  console.log(`recategorizedMortgage=${stats.recategorizedMortgage}`);
  console.log(`skippedInvalidAmount=${stats.skippedInvalidAmount}`);
  console.log(`skippedInvalidDate=${stats.skippedInvalidDate}`);
  console.log(`skippedZeroAmount=${stats.skippedZeroAmount}`);
  console.log(`categoriesCreated=${stats.categoriesCreated}`);
}
