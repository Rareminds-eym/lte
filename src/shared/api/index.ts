import { apiFetch } from "./client";

export { ApiError } from "./ApiError";
export { authClient } from "./authClient";
export { apiFetch, apiFetchBlob } from "./client";

export async function apiGet<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(url, {
    ...options,
    method: "GET",
  });
}
