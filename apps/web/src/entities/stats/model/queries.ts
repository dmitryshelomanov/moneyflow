import { useQuery } from "@tanstack/react-query";
import { statsApi } from "@/entities/stats/api/stats-api";

export const statsKeys = {
  meta: ["stats-meta"] as const,
  dashboard: (fromIso: string, toIso: string, granularity: string) =>
    ["dashboard", fromIso, toIso, granularity] as const,
};

export function useStatsMetaQuery() {
  return useQuery({
    queryKey: statsKeys.meta,
    queryFn: statsApi.statsMeta,
  });
}
