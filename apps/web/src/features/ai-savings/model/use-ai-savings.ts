import type { SavingsAdviceResponse } from "@moneyflow/shared";
import { useAdviceMutation } from "@/features/advice/model/use-advice-mutation";
import { adviceApi } from "@/features/ai-savings/api/advice-api";

type RequestArgs = {
  from: string;
  to: string;
  maxTips?: number;
};

export function useAiSavings() {
  const mutation = useAdviceMutation<RequestArgs, SavingsAdviceResponse>(
    ({ from, to, maxTips = 5 }) =>
      adviceApi.getSavingsAdvice({ from, to, maxTips }),
  );

  return {
    requestAdvice: mutation.request,
    isPending: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
