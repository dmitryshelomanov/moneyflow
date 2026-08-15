import { request } from "@/shared/api/http";

export type User = { id: number; name: string };

export const sessionApi = {
  me: () => request<{ user: User | null }>("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  devLogin: (body?: { id?: number; name?: string }) =>
    request("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  telegramAuth: (payload: Record<string, unknown>) =>
    request("/auth/telegram", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
