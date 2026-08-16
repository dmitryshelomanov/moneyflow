import { apiBase } from "@/shared/lib/access-key";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim().length > 0) return body;
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim().length > 0) return error;
    if (error instanceof Error && error.message) return error.message;
    if (error != null) return String(error);
  }
  return fallback;
}

async function readJsonBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const contentLength = res.headers.get("content-length");
  if (contentLength === "0") return undefined;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  return res.json();
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => undefined);
    throw new ApiError(
      res.status,
      extractErrorMessage(body, res.statusText || "Request failed"),
    );
  }

  const body = await readJsonBody(res);
  return body as T;
}
