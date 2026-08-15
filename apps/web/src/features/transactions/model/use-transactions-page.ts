import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category, Transaction } from "@moneyflow/shared";
import { useSearchParams } from "react-router-dom";
import {
  categoryKeys,
  useCategoriesQuery,
} from "@/entities/category/model/queries";
import { statsKeys, useStatsMetaQuery } from "@/entities/stats/model/queries";
import { transactionApi } from "@/entities/transaction/api/transaction-api";
import {
  transactionKeys,
  useTransactionsInfiniteQuery,
} from "@/entities/transaction/model/queries";
import {
  dayKey,
  formatDayLabel,
  periodDefaults,
  toIsoRange,
} from "@/shared/lib/date";

type TransactionForm = {
  type: "expense" | "income";
  amount: string;
  note: string;
  occurredAt: string;
  categoryId: string;
};

export function useTransactionsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaults = useMemo(() => periodDefaults(), []);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const typeParam = searchParams.get("type");
  const categoryIdParam = searchParams.get("categoryId");
  const [from, setFrom] = useState(fromParam ?? defaults.from.slice(0, 10));
  const [to, setTo] = useState(toParam ?? defaults.to.slice(0, 10));
  const [type, setType] = useState<"" | "expense" | "income">(
    typeParam === "expense" || typeParam === "income" ? typeParam : "",
  );
  const [categoryId, setCategoryId] = useState(categoryIdParam ?? "");
  const [form, setForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    note: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    categoryId: "",
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { fromIso, toIso } = useMemo(() => toIsoRange(from, to), [from, to]);

  const categoriesQuery = useCategoriesQuery();
  const statsMetaQuery = useStatsMetaQuery();
  const transactionsQuery = useTransactionsInfiniteQuery({
    fromIso,
    toIso,
    type,
    categoryId,
  });

  const createMutation = useMutation({
    mutationFn: transactionApi.createTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      await queryClient.invalidateQueries({ queryKey: statsKeys.meta });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: transactionApi.deleteTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      await queryClient.invalidateQueries({ queryKey: statsKeys.meta });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });

  const items = useMemo(
    () => transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [transactionsQuery.data],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (
          !transactionsQuery.hasNextPage ||
          transactionsQuery.isFetchingNextPage ||
          transactionsQuery.isPending
        ) {
          return;
        }
        void transactionsQuery.fetchNextPage();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    transactionsQuery.fetchNextPage,
    transactionsQuery.hasNextPage,
    transactionsQuery.isFetchingNextPage,
    transactionsQuery.isPending,
  ]);

  const categories: Category[] = categoriesQuery.data ?? [];
  const allTimeFrom =
    statsMetaQuery.data?.firstTransactionAt?.slice(0, 10) ?? null;
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const dayGroups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of items) {
      const key = dayKey(tx.occurredAt);
      const list = map.get(key);
      if (list) list.push(tx);
      else map.set(key, [tx]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([key, txs]) => ({
        key,
        label: formatDayLabel(key),
        total: txs.reduce(
          (sum, tx) => sum + (tx.type === "income" ? tx.amount : -tx.amount),
          0,
        ),
        currency: txs[0]?.currency ?? "RUB",
        txs,
      }));
  }, [items]);

  return {
    state: {
      from,
      to,
      type,
      categoryId,
      form,
      categories,
      allTimeFrom,
      dayGroups,
      catMap,
      items,
    },
    refs: {
      sentinelRef,
    },
    queries: {
      transactionsQuery,
    },
    mutations: {
      createMutation,
      deleteMutation,
    },
    actions: {
      setFrom,
      setTo,
      setType,
      setCategoryId,
      setForm,
    },
  };
}
