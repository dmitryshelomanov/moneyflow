import type {
  SavingsAdviceRequest,
  SavingsAdviceResponse,
} from "@moneyflow/shared";
import { postAdvice } from "@/features/advice/api/advice-request";

export const adviceApi = {
  getSavingsAdvice: (body: SavingsAdviceRequest) =>
    postAdvice<SavingsAdviceResponse, SavingsAdviceRequest>(
      "/advice/savings",
      body,
    ),
};
