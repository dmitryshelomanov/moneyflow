import type { FinancePulseResponse } from "@moneyflow/shared";
import { useAdviceMutation } from "@/features/advice/model/use-advice-mutation";
import { pulseApi } from "@/features/ai-pulse/api/pulse-api";

type RequestArgs = {
  from: string;
  to: string;
};

export function useAiPulse() {
  const mutation = useAdviceMutation<RequestArgs, FinancePulseResponse>(
    ({ from, to }) => pulseApi.getFinancePulse({ from, to }),
  );

  return {
    requestPulse: mutation.request,
    isPending: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
