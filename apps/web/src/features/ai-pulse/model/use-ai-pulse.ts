import { useMutation } from "@tanstack/react-query";
import type { FinancePulseResponse } from "@moneyflow/shared";
import { pulseApi } from "@/features/ai-pulse/api/pulse-api";

type RequestArgs = {
  from: string;
  to: string;
};

export function useAiPulse() {
  const mutation = useMutation({
    mutationFn: ({ from, to }: RequestArgs) =>
      pulseApi.getFinancePulse({ from, to }),
  });

  return {
    requestPulse: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: (mutation.data ?? null) as FinancePulseResponse | null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
