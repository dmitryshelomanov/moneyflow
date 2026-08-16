import { createContext, useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionApi, type User } from "@/entities/session/api/session-api";
import { sessionKeys, useSessionQuery } from "@/entities/session/model/queries";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  refresh: () => Promise<void>;
  retrySession: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useSessionQuery();

  const logoutMutation = useMutation({
    mutationFn: sessionApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(sessionKeys.me, { user: null });
    },
  });

  const refresh = async () => {
    await meQuery.refetch();
  };
  const retrySession = async () => {
    await meQuery.refetch();
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const user: User | null = meQuery.data?.user ?? null;
  const loading = meQuery.isPending;
  const sessionError =
    meQuery.error instanceof Error
      ? meQuery.error.message
      : meQuery.isError
        ? "Не удалось проверить сессию"
        : null;

  return (
    <Ctx.Provider
      value={{ user, loading, sessionError, refresh, retrySession, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
