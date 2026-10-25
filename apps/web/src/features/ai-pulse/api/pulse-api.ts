import type {
  FinancePulseRequest,
  FinancePulseResponse,
} from "@moneyflow/shared";
import { postAdvice } from "@/features/advice/api/advice-request";

export const pulseApi = {
  getFinancePulse: (body: FinancePulseRequest) =>
    postAdvice<FinancePulseResponse, FinancePulseRequest>(
      "/advice/pulse",
      body,
    ),
};
