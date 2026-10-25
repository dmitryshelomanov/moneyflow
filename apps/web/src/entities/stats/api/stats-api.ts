import type {
  BalancePoint,
  StatsSummary,
  TransactionType,
  TimeseriesPoint,
} from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export type ParetoPoint = {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  total: number;
  sharePct: number;
  cumulativePct: number;
};

export type HeatmapCell = {
  weekday: number;
  hour: number;
  count: number;
  total: number;
};

function buildStatsParams(fields: {
  from?: string;
  to?: string;
  granularity?: string;
  accountId?: string;
  type?: TransactionType;
}) {
  const params = new URLSearchParams();
  if (fields.from) params.set("from", fields.from);
  if (fields.to) params.set("to", fields.to);
  if (fields.granularity) params.set("granularity", fields.granularity);
  if (fields.accountId) params.set("accountId", fields.accountId);
  if (fields.type) params.set("type", fields.type);
  return params;
}

export const statsApi = {
  summary: (from?: string, to?: string, accountId?: string) => {
    const params = buildStatsParams({ from, to, accountId });
    return request<StatsSummary>(`/stats/summary?${params}`);
  },
  statsMeta: (accountId?: string) => {
    const params = buildStatsParams({ accountId });
    return request<{ firstTransactionAt: string | null }>(
      `/stats/meta?${params}`,
    );
  },
  timeseries: (
    from: string,
    to: string,
    granularity = "day",
    accountId?: string,
  ) => {
    const params = buildStatsParams({ from, to, granularity, accountId });
    return request<TimeseriesPoint[]>(`/stats/timeseries?${params}`);
  },
  balanceSeries: (
    from: string,
    to: string,
    granularity = "month",
    accountId?: string,
  ) => {
    const params = buildStatsParams({ from, to, granularity, accountId });
    return request<BalancePoint[]>(`/stats/balance-series?${params}`);
  },
  categoryPareto: (
    from: string,
    to: string,
    type: TransactionType,
    accountId?: string,
  ) => {
    const params = buildStatsParams({ from, to, type, accountId });
    return request<ParetoPoint[]>(`/stats/category-pareto?${params}`);
  },
  spendingHeatmap: (
    from: string,
    to: string,
    type: TransactionType,
    accountId?: string,
  ) => {
    const params = buildStatsParams({ from, to, type, accountId });
    return request<HeatmapCell[]>(`/stats/spending-heatmap?${params}`);
  },
};
