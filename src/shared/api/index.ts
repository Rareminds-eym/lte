export { ApiError } from "./ApiError";
export { apiFetch, registerTokenGetter } from "./client";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    const message = errorPayload.error ?? errorPayload.message ?? response.statusText;
    throw new Error(message || "API request failed");
  }

  return payload as T;
}

export async function apiGet<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  return parseJsonResponse<T>(
    await fetch(url, {
      ...options,
      method: "GET",
      credentials: options?.credentials ?? "include",
    }),
  );
}
