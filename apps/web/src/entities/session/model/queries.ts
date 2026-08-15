import { useQuery } from "@tanstack/react-query";
import { sessionApi } from "@/entities/session/api/session-api";

export const sessionKeys = {
  me: ["auth", "me"] as const,
};

export function useSessionQuery() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: sessionApi.me,
    retry: false,
  });
}
