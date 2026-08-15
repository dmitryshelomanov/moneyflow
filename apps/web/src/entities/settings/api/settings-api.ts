import type { Settings, UpdateSettings } from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const settingsApi = {
  settings: () => request<Settings>("/settings"),
  updateSettings: (body: UpdateSettings) =>
    request<Settings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
