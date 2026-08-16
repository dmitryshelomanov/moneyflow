import { useQuery } from "@tanstack/react-query";
import { statsApi } from "@/entities/stats/api/stats-api";

export const statsKeys = {
  meta: ["stats-meta"] as const,
  dashboardRoot: ["dashboard"] as const,
  dashboard: (
    fromIso: string,
    toIso: string,
    granularity: string,
    accountId?: string,
  ) => ["dashboard", fromIso, toIso, granularity, accountId ?? "all"] as const,
};

export function useStatsMetaQuery() {
  return useQuery({
    queryKey: statsKeys.meta,
    queryFn: () => statsApi.statsMeta(),
  });
}
