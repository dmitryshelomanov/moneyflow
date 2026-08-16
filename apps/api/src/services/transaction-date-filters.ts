import { gte, lte } from "drizzle-orm";
import { transactions } from "../db/schema.js";

export function buildTransactionDateRangeConditions(
  from?: string,
  to?: string,
) {
  const conditions = [];
  if (from) conditions.push(gte(transactions.occurredAt, from));
  if (to) conditions.push(lte(transactions.occurredAt, to));
  return conditions;
}
