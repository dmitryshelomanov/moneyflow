import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fromMinorUnits } from "@moneyflow/shared";
import { statsApi } from "@/entities/stats/api/stats-api";
import { statsKeys } from "@/entities/stats/model/queries";
import { transactionKeys } from "@/entities/transaction/model/queries";
import { quickParseApi } from "@/features/quick-parse/api/quick-parse-api";
import { pickGranularity, type Granularity } from "@/shared/lib/chart";
import {
  periodDefaults,
  previousPeriodYmdRange,
  formatYmd,
  toIsoRange,
} from "@/shared/lib/date";

export function useDashboard() {
  const queryClient = useQueryClient();
  const defaults = useMemo(() => periodDefaults(), []);
  const [from, setFrom] = useState(defaults.from.slice(0, 10));
  const [to, setTo] = useState(defaults.to.slice(0, 10));
  const [quickText, setQuickText] = useState("");
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
  const rollingExpenseRange = useMemo(() => {
    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
    const fromDate = new Date(toDate);
    fromDate.setMonth(fromDate.getMonth() - 5);
    fromDate.setHours(0, 0, 0, 0);
    return {
      from: formatYmd(fromDate),
      to: formatYmd(toDate),
    };
  }, []);
  const { fromIso: rollingExpenseFromIso, toIso: rollingExpenseToIso } =
    useMemo(
      () => toIsoRange(rollingExpenseRange.from, rollingExpenseRange.to),
      [rollingExpenseRange.from, rollingExpenseRange.to],
    );
  const previousYmdRange = useMemo(
    () => previousPeriodYmdRange(from, to),
    [from, to],
  );
  const { fromIso: previousFromIso, toIso: previousToIso } = useMemo(
    () => toIsoRange(previousYmdRange.from, previousYmdRange.to),
    [previousYmdRange.from, previousYmdRange.to],
  );

  useEffect(() => {
    if (!isLongRange) {
      setLongRangeGranularity("year");
    }
  }, [isLongRange]);

  const dashboardQuery = useQuery({
    queryKey: statsKeys.dashboard(
      fromIso,
      toIso,
      `${granularity}:${balanceGranularity}`,
    ),
    queryFn: async () => {
      const [
        summary,
        previousSummary,
        series,
        daySeries,
        balanceSeries,
        meta,
        expensePareto,
        expenseHeatmap,
        rollingExpenseSummary,
      ] = await Promise.all([
        statsApi.summary(fromIso, toIso),
        statsApi.summary(previousFromIso, previousToIso),
        statsApi.timeseries(fromIso, toIso, granularity),
        statsApi.timeseries(fromIso, toIso, "day"),
        statsApi.balanceSeries(fromIso, toIso, balanceGranularity),
        statsApi.statsMeta(),
        statsApi.categoryPareto(fromIso, toIso, "expense"),
        statsApi.spendingHeatmap(fromIso, toIso, "expense"),
        statsApi.summary(rollingExpenseFromIso, rollingExpenseToIso),
      ]);
      return {
        summary,
        previousSummary,
        series,
        daySeries,
        balanceSeries,
        meta,
        expensePareto,
        expenseHeatmap,
        rollingExpenseSummary,
      };
    },
  });

  const parseMutation = useMutation({
    mutationFn: () => quickParseApi.parse({ text: quickText, save: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      setQuickText("");
      setMessage("Записано");
    },
  });

  const summary = dashboardQuery.data?.summary ?? null;
  const series = dashboardQuery.data?.series ?? [];
  const balanceSeries = dashboardQuery.data?.balanceSeries ?? [];
  const daySeries = dashboardQuery.data?.daySeries ?? [];
  const previousSummary = dashboardQuery.data?.previousSummary ?? null;
  const expensePareto = dashboardQuery.data?.expensePareto ?? [];
  const expenseHeatmap = dashboardQuery.data?.expenseHeatmap ?? [];
  const rollingExpenseSummary =
    dashboardQuery.data?.rollingExpenseSummary ?? null;
  const averageExpensePerMonthMinor = rollingExpenseSummary
    ? Math.round(rollingExpenseSummary.periodExpense / 6)
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
  const previousRatio =
    previousSummary && previousSummary.periodIncome > 0
      ? Math.round(
          (previousSummary.periodExpense / previousSummary.periodIncome) * 100,
        )
      : null;

  const delta = {
    balance:
      summary && previousSummary
        ? summary.balance - previousSummary.balance
        : null,
    periodIncome:
      summary && previousSummary
        ? summary.periodIncome - previousSummary.periodIncome
        : null,
    periodExpense:
      summary && previousSummary
        ? summary.periodExpense - previousSummary.periodExpense
        : null,
    ratio:
      ratio != null && previousRatio != null ? ratio - previousRatio : null,
  };

  return {
    state: {
      from,
      to,
      quickText,
      message,
      granularity,
      balanceGranularity,
      longRangeGranularity,
      isLongRange,
      summary,
      previousSummary,
      series,
      daySeries,
      balanceSeries,
      expensePareto,
      expenseHeatmap,
      allTimeFrom,
      expenseCats,
      incomeCats,
      ratio,
      previousRatio,
      delta,
      averageExpensePerMonthMinor,
    },
    queries: {
      dashboardQuery,
    },
    mutations: {
      parseMutation,
    },
    actions: {
      setFrom,
      setTo,
      setQuickText,
      setMessage,
      setLongRangeGranularity,
    },
  };
}
