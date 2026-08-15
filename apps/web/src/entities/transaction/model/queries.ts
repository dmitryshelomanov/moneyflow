import { useInfiniteQuery } from "@tanstack/react-query";
import type { TransactionType } from "@moneyflow/shared";
import { transactionApi } from "@/entities/transaction/api/transaction-api";

export const transactionKeys = {
  list: (
    fromIso: string,
    toIso: string,
    type: "" | TransactionType,
    categoryId: string,
  ) => ["transactions", fromIso, toIso, type, categoryId] as const,
  root: ["transactions"] as const,
};

type ListParams = {
  fromIso: string;
  toIso: string;
  type: "" | TransactionType;
  categoryId: string;
};

export function useTransactionsInfiniteQuery({
  fromIso,
  toIso,
  type,
  categoryId,
}: ListParams) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(fromIso, toIso, type, categoryId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      transactionApi.transactions({
        from: fromIso,
        to: toIso,
        type: type || undefined,
        categoryId: categoryId || undefined,
        cursor: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });
}
