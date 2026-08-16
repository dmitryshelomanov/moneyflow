import { useInfiniteQuery } from "@tanstack/react-query";
import type { TransactionType } from "@moneyflow/shared";
import { transactionApi } from "@/entities/transaction/api/transaction-api";

type ListParams = {
  fromIso: string;
  toIso: string;
  type: "" | TransactionType;
  accountId: string;
  categoryId: string;
  q: string;
};

type NormalizedListParams = {
  fromIso: string;
  toIso: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  q?: string;
};

function normalizeListParams(params: ListParams): NormalizedListParams {
  return {
    fromIso: params.fromIso,
    toIso: params.toIso,
    type: params.type || undefined,
    accountId: params.accountId || undefined,
    categoryId: params.categoryId || undefined,
    q: params.q.trim() || undefined,
  };
}

export const transactionKeys = {
  list: (params: ListParams) =>
    ["transactions", "list", normalizeListParams(params)] as const,
  root: ["transactions"] as const,
};

export function useTransactionsInfiniteQuery({
  fromIso,
  toIso,
  type,
  accountId,
  categoryId,
  q,
}: ListParams) {
  const normalizedParams = normalizeListParams({
    fromIso,
    toIso,
    type,
    accountId,
    categoryId,
    q,
  });

  return useInfiniteQuery({
    queryKey: transactionKeys.list({
      fromIso,
      toIso,
      type,
      accountId,
      categoryId,
      q,
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      transactionApi.transactions({
        from: normalizedParams.fromIso,
        to: normalizedParams.toIso,
        type: normalizedParams.type,
        accountId: normalizedParams.accountId,
        categoryId: normalizedParams.categoryId,
        q: normalizedParams.q,
        cursor: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });
}
