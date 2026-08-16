import type {
  ImportCsvAiResponse,
  ParseBatch,
  ParseResult,
} from "@moneyflow/shared";
import { applyParseBatch } from "./apply-parse.js";
import { parseCsvRowsWithAi } from "./ai.js";

const CHUNK_SIZE = 20;
const MAX_ERRORS = 30;
const DELIMITERS = [",", ";", "\t"] as const;

function parseCsvLine(line: string, delimiter: string): string[] {
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
    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields.map((item) => item.trim());
}

function detectDelimiter(headerLine: string): string {
  let bestDelimiter = ",";
  let bestColumns = 0;
  for (const delimiter of DELIMITERS) {
    const columns = parseCsvLine(headerLine, delimiter).length;
    if (columns > bestColumns) {
      bestColumns = columns;
      bestDelimiter = delimiter;
    }
  }
  return bestDelimiter;
}

function parseCsvRows(csv: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(
    (header, index) => header || `column_${index + 1}`,
  );

  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      const value = values[i] ?? "";
      if (value.length > 0) {
        row[headers[i]!] = value;
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeBatchKind(transactions: ParseResult[]): ParseBatch["kind"] {
  if (transactions.length > 1) return "list";
  return "single";
}

function isValidOccurredAt(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function appendError(errors: string[], message: string) {
  if (errors.length >= MAX_ERRORS) return;
  errors.push(message);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export async function importCsvWithAi(input: {
  csv: string;
  filename?: string;
  promptExtension?: string;
}): Promise<ImportCsvAiResponse> {
  const { headers, rows } = parseCsvRows(input.csv);
  const stats: ImportCsvAiResponse = {
    totalRows: rows.length,
    parsed: 0,
    saved: 0,
    skipped: 0,
    errors: [],
  };

  if (headers.length === 0) {
    stats.errors.push("CSV is empty");
    return stats;
  }

  if (rows.length === 0) {
    stats.errors.push("CSV contains header only");
    return stats;
  }

  const chunks = chunkRows(rows, CHUNK_SIZE);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;

    try {
      const parsed = await parseCsvRowsWithAi({
        headers,
        rows: chunk,
        chunkIndex: index + 1,
        promptExtension: input.promptExtension,
      });
      const normalizedTransactions = parsed.transactions.filter(
        (tx) => tx.amount > 0 && isValidOccurredAt(tx.occurredAt),
      );

      stats.parsed += normalizedTransactions.length;
      stats.skipped += Math.max(
        0,
        chunk.length - normalizedTransactions.length,
      );

      if (normalizedTransactions.length === 0) {
        continue;
      }

      const saved = applyParseBatch(
        {
          kind: normalizeBatchKind(normalizedTransactions),
          transactions: normalizedTransactions,
        },
        {
          source: "web",
          rawText: JSON.stringify({
            filename: input.filename ?? null,
            chunk: index + 1,
            rows: chunk,
          }),
        },
      );
      stats.saved += saved.transactions.length;
    } catch (error) {
      stats.skipped += chunk.length;
      appendError(
        stats.errors,
        `Chunk ${index + 1} failed: ${errorMessage(error)}`,
      );
    }
  }

  return stats;
}
