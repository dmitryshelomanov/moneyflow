import type {
  SavingsAdviceRequest,
  SavingsAdviceResponse,
} from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const adviceApi = {
  getSavingsAdvice: (body: SavingsAdviceRequest) =>
    request<SavingsAdviceResponse>("/advice/savings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
