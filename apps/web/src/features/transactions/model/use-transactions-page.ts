import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Account,
  Category,
  Transaction,
  TransactionType,
} from "@moneyflow/shared";
import useInfiniteScroll from "react-infinite-scroll-hook";
import { useSearchParams } from "react-router-dom";
import {
  accountKeys,
  useAccountsQuery,
} from "@/entities/account/model/queries";
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
import { usePeriod } from "@/features/period/model/period-context";
import { dayKey, formatDayLabel, toIsoRange } from "@/shared/lib/date";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

type TransactionForm = {
  type: TransactionType;
  amount: string;
  note: string;
  occurredAt: string;
  accountId: string;
  categoryId: string;
};

type PeriodRange = {
  from: string;
  to: string;
};

type InitialPeriodParams = {
  fromParam: string | null;
  toParam: string | null;
  defaults: PeriodRange;
};

type BulkUpdateInput = {
  selectedIds: string[];
  categoryId?: string | null;
  accountId?: string;
};

function normalizeSearchQuery(value: string | null) {
  return value?.trim() ?? "";
}

function parseTransactionType(value: string | null): "" | TransactionType {
  return value === "expense" || value === "income" ? value : "";
}

function resolveInitialPeriod({
  fromParam,
  toParam,
  defaults,
}: InitialPeriodParams) {
  return {
    from: fromParam ?? defaults.from,
    to: toParam ?? defaults.to,
  };
}

function usePinWindowScroll(isAppending: boolean, itemCount: number) {
  // Browsers keep the viewport glued to the document bottom when rows are
  // appended there. Pin scrollY until the fetch finishes so new items grow
  // below the screen instead of pulling the page down.
  const pinnedYRef = useRef<number | null>(null);

  const pin = useCallback(() => {
    pinnedYRef.current ??= window.scrollY;
  }, []);

  const unpin = useCallback(() => {
    pinnedYRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const pinnedY = pinnedYRef.current;
    if (pinnedY == null) return;
    window.scrollTo(0, pinnedY);
    if (!isAppending) pinnedYRef.current = null;
  }, [itemCount, isAppending]);

  return { pin, unpin };
}

function groupTransactionsByDay(items: Transaction[]) {
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
}

export function useTransactionsPage() {
  const queryClient = useQueryClient();
  const { period: dashboardPeriod } = usePeriod();
  const [searchParams] = useSearchParams();
  const periodFallbackRef = useRef(dashboardPeriod);
  const periodFallback = periodFallbackRef.current;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const typeParam = searchParams.get("type");
  const accountIdParam = searchParams.get("accountId");
  const categoryIdParam = searchParams.get("categoryId");
  const qParam = searchParams.get("q");
  const [period, setPeriod] = useState(() =>
    resolveInitialPeriod({
      fromParam,
      toParam,
      defaults: periodFallback,
    }),
  );
  const { from, to } = period;
  const [type, setType] = useState<"" | TransactionType>(
    parseTransactionType(typeParam),
  );
  const [accountId, setAccountId] = useState(accountIdParam ?? "");
  const [categoryId, setCategoryId] = useState(categoryIdParam ?? "");
  const [q, setQ] = useState(normalizeSearchQuery(qParam));
  const debouncedQ = useDebouncedValue(q, 300, true);
  const [form, setForm] = useState<TransactionForm>({
    type: "expense",
    amount: "",
    note: "",
    occurredAt: new Date().toISOString().slice(0, 10),
    accountId: "",
    categoryId: "",
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (fromParam || toParam) {
      setPeriod(
        resolveInitialPeriod({
          fromParam,
          toParam,
          defaults: periodFallback,
        }),
      );
    }
    setType(parseTransactionType(typeParam));
    setAccountId(accountIdParam ?? "");
    setCategoryId(categoryIdParam ?? "");
    setQ(normalizeSearchQuery(qParam));
  }, [
    accountIdParam,
    categoryIdParam,
    fromParam,
    periodFallback,
    qParam,
    toParam,
    typeParam,
  ]);

  const { fromIso, toIso } = toIsoRange(from, to);

  const categoriesQuery = useCategoriesQuery();
  const accountsQuery = useAccountsQuery();
  const statsMetaQuery = useStatsMetaQuery();
  const transactionsQuery = useTransactionsInfiniteQuery({
    fromIso,
    toIso,
    type,
    accountId,
    categoryId,
    q: debouncedQ,
  });

  const invalidateAfterMutation = useCallback(
    async (includeCategories = false) => {
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      await queryClient.invalidateQueries({ queryKey: statsKeys.meta });
      await queryClient.invalidateQueries({
        queryKey: statsKeys.dashboardRoot,
      });
      if (includeCategories) {
        await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      }
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: transactionApi.createTransaction,
    onSuccess: async () => {
      await invalidateAfterMutation();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({
      categoryId,
      accountId,
      selectedIds,
    }: BulkUpdateInput) => {
      const patch =
        accountId !== undefined
          ? { accountId }
          : { categoryId: categoryId ?? null };
      const results = await Promise.allSettled(
        selectedIds.map((id) => transactionApi.updateTransaction(id, patch)),
      );
      const updated = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const total = results.length;
      if (updated < total) {
        throw new Error(`Обновлено ${updated} из ${total}`);
      }
      return { updated, total };
    },
    onSuccess: () => {
      setSelectedIds([]);
      setSelectionMode(false);
    },
    onSettled: async () => {
      await invalidateAfterMutation();
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      transactionApi.updateTransaction(id, { accountId }),
    onSettled: async () => {
      await invalidateAfterMutation();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: transactionApi.deleteTransaction,
    onSuccess: async () => {
      await invalidateAfterMutation(true);
    },
  });

  const items = useMemo(
    () => transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [transactionsQuery.data],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => items.filter((tx) => selectedSet.has(tx.id)),
    [items, selectedSet],
  );

  const { pin: pinWindowScroll, unpin: unpinWindowScroll } = usePinWindowScroll(
    transactionsQuery.isFetchingNextPage,
    items.length,
  );

  const loadMore = useCallback(() => {
    pinWindowScroll();
    void transactionsQuery.fetchNextPage();
  }, [pinWindowScroll, transactionsQuery.fetchNextPage]);

  const [infiniteRef] = useInfiniteScroll({
    loading: transactionsQuery.isFetchingNextPage,
    hasNextPage: Boolean(transactionsQuery.hasNextPage),
    onLoadMore: loadMore,
    disabled: transactionsQuery.isError,
  });

  useEffect(() => {
    unpinWindowScroll();
  }, [
    accountId,
    categoryId,
    debouncedQ,
    fromIso,
    toIso,
    type,
    unpinWindowScroll,
  ]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => items.some((tx) => tx.id === id)),
    );
  }, [items]);

  useEffect(() => {
    if (form.accountId) return;
    const defaultAccount = accountsQuery.data?.find(
      (account) => account.isDefault,
    );
    if (!defaultAccount) return;
    setForm((prev) => ({ ...prev, accountId: defaultAccount.id }));
  }, [accountsQuery.data, form.accountId]);

  const categories: Category[] = categoriesQuery.data ?? [];
  const accounts: Account[] = accountsQuery.data ?? [];
  const allTimeFrom =
    statsMetaQuery.data?.firstTransactionAt?.slice(0, 10) ?? null;
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const dayGroups = useMemo(() => {
    return groupTransactionsByDay(items);
  }, [items]);

  const loadedTotals = useMemo(() => {
    let incomeTotalMinor = 0;
    let expenseTotalMinor = 0;
    for (const tx of items) {
      if (tx.type === "income") incomeTotalMinor += tx.amount;
      else expenseTotalMinor += tx.amount;
    }
    return {
      incomeTotalMinor,
      expenseTotalMinor,
      currency: items[0]?.currency ?? "RUB",
    };
  }, [items]);

  return {
    state: {
      q,
      hasActiveSearch: debouncedQ.length > 0,
      from,
      to,
      type,
      accountId,
      categoryId,
      form,
      accounts,
      categories,
      accountMap,
      allTimeFrom,
      dayGroups,
      catMap,
      items,
      loadedTotals,
      selectionMode,
      selectedIds,
      selectedItems,
      selectedCount: selectedItems.length,
    },
    refs: {
      infiniteRef,
    },
    queries: {
      transactionsQuery,
    },
    mutations: {
      createMutation,
      bulkUpdateMutation,
      updateAccountMutation,
      deleteMutation,
    },
    actions: {
      setQ,
      setPeriod,
      setType,
      setAccountId,
      setCategoryId,
      setForm,
      toggleSelectionMode: () =>
        setSelectionMode((prev) => {
          if (prev) setSelectedIds([]);
          return !prev;
        }),
      toggleSelected: (id: string) =>
        setSelectedIds((prev) =>
          prev.includes(id)
            ? prev.filter((item) => item !== id)
            : [...prev, id],
        ),
      clearSelected: () => setSelectedIds([]),
    },
  };
}
