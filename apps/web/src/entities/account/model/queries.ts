import { useQuery } from "@tanstack/react-query";
import { accountApi } from "@/entities/account/api/account-api";

export const accountKeys = {
  all: ["accounts"] as const,
};

export function useAccountsQuery() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: accountApi.accounts,
  });
}
