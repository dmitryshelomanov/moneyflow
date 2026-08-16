import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromMinorUnits } from "@moneyflow/shared";
import { useAccountsQuery } from "@/entities/account/model/queries";
import { statsApi } from "@/entities/stats/api/stats-api";
import { statsKeys } from "@/entities/stats/model/queries";
import { transactionKeys } from "@/entities/transaction/model/queries";
import { usePeriod } from "@/features/period/model/period-context";
import { quickParseApi } from "@/features/quick-parse/api/quick-parse-api";
import { pickGranularity, type Granularity } from "@/shared/lib/chart";
import { toIsoRange } from "@/shared/lib/date";

export function useDashboard() {
  const queryClient = useQueryClient();
  const { period, setPeriod } = usePeriod();
  const accountsQuery = useAccountsQuery();
  const { from, to } = period;
  const [quickText, setQuickText] = useState("");
  const [quickAccountId, setQuickAccountId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [longRangeGranularity, setLongRangeGranularity] =
    useState<Extract<Granularity, "month" | "year">>("year");
  const baseGranularity = useMemo(() => pickGranularity(from, to), [from, to]);
  const isLongRange = baseGranularity === "year";
  const granularity: Extract<Granularity, "month" | "year"> = isLongRange
    ? longRangeGranularity
    : "month";
  const balanceGranularity: Granularity = granularity;
  const { fromIso, toIso } = useMemo(() => toIsoRange(from, to), [from, to]);
  const monthSpan = useMemo(() => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const months =
      (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
      (toDate.getMonth() - fromDate.getMonth()) +
      1;
    return Math.max(1, months);
  }, [from, to]);
  useEffect(() => {
    if (!isLongRange) {
      setLongRangeGranularity("year");
    }
  }, [isLongRange]);
  useEffect(() => {
    if (quickAccountId) return;
    const defaultAccount = accountsQuery.data?.find(
      (account) => account.isDefault,
    );
    if (!defaultAccount) return;
    setQuickAccountId(defaultAccount.id);
  }, [accountsQuery.data, quickAccountId]);

  const dashboardQuery = useQuery({
    queryKey: statsKeys.dashboard(
      fromIso,
      toIso,
      `${granularity}:${balanceGranularity}`,
      selectedAccountId || undefined,
    ),
    queryFn: async () => {
      const [
        summary,
        series,
        balanceSeries,
        meta,
        expensePareto,
        expenseHeatmap,
      ] = await Promise.all([
        statsApi.summary(fromIso, toIso, selectedAccountId || undefined),
        statsApi.timeseries(
          fromIso,
          toIso,
          granularity,
          selectedAccountId || undefined,
        ),
        statsApi.balanceSeries(
          fromIso,
          toIso,
          balanceGranularity,
          selectedAccountId || undefined,
        ),
        statsApi.statsMeta(selectedAccountId || undefined),
        statsApi.categoryPareto(
          fromIso,
          toIso,
          "expense",
          selectedAccountId || undefined,
        ),
        statsApi.spendingHeatmap(
          fromIso,
          toIso,
          "expense",
          selectedAccountId || undefined,
        ),
      ]);
      return {
        summary,
        series,
        balanceSeries,
        meta,
        expensePareto,
        expenseHeatmap,
      };
    },
  });

  const parseMutation = useMutation({
    mutationFn: () =>
      quickParseApi.parse({
        text: quickText,
        save: true,
        accountId: quickAccountId || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: statsKeys.dashboardRoot,
      });
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      setQuickText("");
      setMessage("Записано");
    },
  });

  const summary = dashboardQuery.data?.summary ?? null;
  const series = dashboardQuery.data?.series ?? [];
  const balanceSeries = dashboardQuery.data?.balanceSeries ?? [];
  const expensePareto = dashboardQuery.data?.expensePareto ?? [];
  const expenseHeatmap = dashboardQuery.data?.expenseHeatmap ?? [];
  const averageExpensePerMonthMinor = summary
    ? Math.round(summary.periodExpense / monthSpan)
    : 0;
  const allTimeFrom =
    dashboardQuery.data?.meta.firstTransactionAt?.slice(0, 10) ?? null;

  const expenseCats =
    summary?.byCategory
      .filter((c) => c.type === "expense")
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.categoryName,
        value: fromMinorUnits(c.total),
        totalMinor: c.total,
        icon: c.icon,
      })) ?? [];
  const incomeCats =
    summary?.byCategory
      .filter((c) => c.type === "income")
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.categoryName,
        value: fromMinorUnits(c.total),
        totalMinor: c.total,
        icon: c.icon,
      })) ?? [];

  const ratio =
    summary && summary.periodIncome > 0
      ? Math.round((summary.periodExpense / summary.periodIncome) * 100)
      : null;

  return {
    state: {
      from,
      to,
      quickText,
      quickAccountId,
      selectedAccountId,
      accounts: accountsQuery.data ?? [],
      message,
      granularity,
      balanceGranularity,
      longRangeGranularity,
      isLongRange,
      summary,
      series,
      balanceSeries,
      expensePareto,
      expenseHeatmap,
      allTimeFrom,
      expenseCats,
      incomeCats,
      ratio,
      averageExpensePerMonthMinor,
    },
    queries: {
      dashboardQuery,
    },
    mutations: {
      parseMutation,
    },
    actions: {
      setPeriod,
      setQuickText,
      setQuickAccountId,
      setSelectedAccountId,
      setMessage,
      setLongRangeGranularity,
    },
  };
}
