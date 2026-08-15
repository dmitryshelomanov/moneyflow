import type {
  FinancePulseRequest,
  FinancePulseResponse,
} from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const pulseApi = {
  getFinancePulse: (body: FinancePulseRequest) =>
    request<FinancePulseResponse>("/advice/pulse", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
