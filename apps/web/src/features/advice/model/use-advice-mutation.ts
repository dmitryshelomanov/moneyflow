import { useMutation } from "@tanstack/react-query";

export function useAdviceMutation<TArgs, TData>(
  mutationFn: (args: TArgs) => Promise<TData>,
) {
  const mutation = useMutation({ mutationFn });

  return {
    request: mutation.mutateAsync,
    isPending: mutation.isPending,
    data: (mutation.data ?? null) as TData | null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
