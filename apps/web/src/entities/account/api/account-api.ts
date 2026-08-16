import type { Account, CreateAccount, UpdateAccount } from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const accountApi = {
  accounts: () => request<Account[]>("/accounts"),
  createAccount: (body: CreateAccount) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAccount: (id: string, body: UpdateAccount) =>
    request<Account>(`/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: "DELETE" }),
};
