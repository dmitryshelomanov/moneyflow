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
  summary: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request<StatsSummary>(`/stats/summary?${params}`);
  },
  statsMeta: () =>
    request<{ firstTransactionAt: string | null }>("/stats/meta"),
  timeseries: (from: string, to: string, granularity = "day") => {
    const params = new URLSearchParams({ from, to, granularity });
    return request<TimeseriesPoint[]>(`/stats/timeseries?${params}`);
  },
  balanceSeries: (from: string, to: string, granularity = "month") => {
    const params = new URLSearchParams({ from, to, granularity });
    return request<BalancePoint[]>(`/stats/balance-series?${params}`);
  },
  categoryPareto: (from: string, to: string, type: TransactionType) => {
    const params = new URLSearchParams({ from, to, type });
    return request<ParetoPoint[]>(`/stats/category-pareto?${params}`);
  },
  spendingHeatmap: (from: string, to: string, type: TransactionType) => {
    const params = new URLSearchParams({ from, to, type });
    return request<HeatmapCell[]>(`/stats/spending-heatmap?${params}`);
  },
};
