import { getLogger } from "../config/logging";
import { ApiError } from "./ApiError";

const logger = getLogger("apiFetch");

type TokenGetter = () => string | null;

let getToken: TokenGetter = () => null;

/**
 * Register a callback that returns the current access token.
 * This permits the shared API layer to implicitly inject bearer authorization
 * without directly importing or depending on the session entity layer.
 */
export const registerTokenGetter = (getter: TokenGetter): void => {
  getToken = getter;
};

/**
 * Generic API Fetch client designed for LTE domain requests.
 * Automatically injects authorization headers, logs queries, and handles errors.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Ensure content-type defaults to application/json if sending a body
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  logger.info(`Request: ${options.method || "GET"} ${path}`);

  const response = await fetch(path, mergedOptions);

  if (!response.ok) {
    let errorMessage = `API Request failed with status ${response.status}`;
    try {
      const errorJson = (await response.json()) as {
        message?: string;
        error?: string | { message?: string };
      };
      if (errorJson.message) {
        errorMessage = errorJson.message;
      } else if (errorJson.error) {
        if (typeof errorJson.error === "string") {
          errorMessage = errorJson.error;
        } else if (typeof errorJson.error === "object" && errorJson.error.message) {
          errorMessage = errorJson.error.message;
        }
      }
    } catch {
      // Ignore JSON parse failure on error response
    }

    logger.error(`Response Error: ${response.status} ${path} — ${errorMessage}`);
    throw new ApiError(errorMessage, response.status);
  }

  logger.info(`Response Success: ${response.status} ${path}`);

  // Handle empty responses or 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  return (await response.json()) as T;
}
