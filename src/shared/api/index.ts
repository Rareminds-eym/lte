export { ApiError } from "./ApiError";
export { apiFetch, registerTokenGetter } from "./client";

export async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
