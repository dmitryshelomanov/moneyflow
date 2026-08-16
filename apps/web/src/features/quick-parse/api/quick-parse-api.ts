import { request } from "@/shared/api/http";

export const quickParseApi = {
  parse: (body: { text?: string; save?: boolean; accountId?: string }) =>
    request("/parse", { method: "POST", body: JSON.stringify(body) }),
};
