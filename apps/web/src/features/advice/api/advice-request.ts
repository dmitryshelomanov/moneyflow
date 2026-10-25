import { request } from "@/shared/api/http";

export function postAdvice<TResponse, TBody extends object>(
  path: "/advice/pulse" | "/advice/savings",
  body: TBody,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
