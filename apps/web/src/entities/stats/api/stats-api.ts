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

export const statsApi = {
  summary: (from?: string, to?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (accountId) params.set("accountId", accountId);
    return request<StatsSummary>(`/stats/summary?${params}`);
  },
  statsMeta: (accountId?: string) => {
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
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
    const params = new URLSearchParams({ from, to, granularity });
    if (accountId) params.set("accountId", accountId);
    return request<TimeseriesPoint[]>(`/stats/timeseries?${params}`);
  },
  balanceSeries: (
    from: string,
    to: string,
    granularity = "month",
    accountId?: string,
  ) => {
    const params = new URLSearchParams({ from, to, granularity });
    if (accountId) params.set("accountId", accountId);
    return request<BalancePoint[]>(`/stats/balance-series?${params}`);
  },
  categoryPareto: (
    from: string,
    to: string,
    type: TransactionType,
    accountId?: string,
  ) => {
    const params = new URLSearchParams({ from, to, type });
    if (accountId) params.set("accountId", accountId);
    return request<ParetoPoint[]>(`/stats/category-pareto?${params}`);
  },
  spendingHeatmap: (
    from: string,
    to: string,
    type: TransactionType,
    accountId?: string,
  ) => {
    const params = new URLSearchParams({ from, to, type });
    if (accountId) params.set("accountId", accountId);
    return request<HeatmapCell[]>(`/stats/spending-heatmap?${params}`);
  },
};
