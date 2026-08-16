import { useInfiniteQuery } from "@tanstack/react-query";
import type { TransactionType } from "@moneyflow/shared";
import { transactionApi } from "@/entities/transaction/api/transaction-api";

type ListParams = {
  fromIso: string;
  toIso: string;
  type: "" | TransactionType;
  categoryId: string;
  q: string;
};

type NormalizedListParams = {
  fromIso: string;
  toIso: string;
  type?: TransactionType;
  categoryId?: string;
  q?: string;
};

function normalizeListParams(params: ListParams): NormalizedListParams {
  return {
    fromIso: params.fromIso,
    toIso: params.toIso,
    type: params.type || undefined,
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
  categoryId,
  q,
}: ListParams) {
  const normalizedParams = normalizeListParams({
    fromIso,
    toIso,
    type,
    categoryId,
    q,
  });

  return useInfiniteQuery({
    queryKey: transactionKeys.list({
      fromIso,
      toIso,
      type,
      categoryId,
      q,
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      transactionApi.transactions({
        from: normalizedParams.fromIso,
        to: normalizedParams.toIso,
        type: normalizedParams.type,
        categoryId: normalizedParams.categoryId,
        q: normalizedParams.q,
        cursor: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });
}
