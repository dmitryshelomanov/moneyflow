import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/entities/settings/api/settings-api";

export const settingsKeys = {
  all: ["settings"] as const,
};

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: settingsApi.settings,
  });
}
