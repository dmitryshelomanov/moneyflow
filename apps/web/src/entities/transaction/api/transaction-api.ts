import type {
  CreateTransaction,
  Transaction,
  TransactionsPage,
  TransactionType,
  UpdateTransaction,
} from "@moneyflow/shared";
import { request } from "@/shared/api/http";

type TransactionsQuery = {
  from?: string;
  to?: string;
  type?: TransactionType;
  categoryId?: string;
  q?: string;
  limit?: number;
  cursor?: string;
};

function toSearchParams(q: TransactionsQuery): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export const transactionApi = {
  transactions: (query: TransactionsQuery) =>
    request<TransactionsPage>(`/transactions?${toSearchParams(query)}`),
  createTransaction: (body: CreateTransaction) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTransaction: (id: string, body: UpdateTransaction) =>
    request<Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTransaction: (id: string) =>
    request<{ ok: boolean }>(`/transactions/${id}`, { method: "DELETE" }),
};
