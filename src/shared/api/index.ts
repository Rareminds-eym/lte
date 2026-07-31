import { apiFetch } from "./client";

export { ApiError } from "./ApiError";
export { apiFetch, registerTokenGetter } from "./client";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export async function apiGet<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(url, {
    ...options,
    method: "GET",
  });
}
