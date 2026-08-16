import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/model/auth-context";
import { PeriodProvider } from "@/features/period/model/period-context";
import { queryClient } from "@/shared/lib/query-client";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PeriodProvider>{children}</PeriodProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
