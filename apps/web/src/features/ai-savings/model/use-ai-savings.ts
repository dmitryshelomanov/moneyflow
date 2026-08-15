import { useMutation } from "@tanstack/react-query";
import type { SavingsAdviceResponse } from "@moneyflow/shared";
import { adviceApi } from "@/features/ai-savings/api/advice-api";

type RequestArgs = {
  from: string;
  to: string;
  maxTips?: number;
};

export function useAiSavings() {
  const mutation = useMutation({
    mutationFn: ({ from, to, maxTips = 5 }: RequestArgs) =>
      adviceApi.getSavingsAdvice({ from, to, maxTips }),
  });

  return {
    requestAdvice: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: (mutation.data ?? null) as SavingsAdviceResponse | null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
