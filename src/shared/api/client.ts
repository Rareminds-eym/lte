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
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
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

  let response: Response;
  try {
    response = await fetch(path, mergedOptions);
  } catch (error) {
    // If it's a cancellation/abort error, propagate it without wrap so React Query handles it correctly
    if (
      error instanceof Error &&
      (error.name === "AbortError" || (error instanceof DOMException && error.code === 20))
    ) {
      logger.info(`Request aborted: ${path}`);
      throw error;
    }
    const message = error instanceof Error ? error.message : "Network request failed";
    logger.error(`Network Error: ${path} — ${message}`);
    throw error instanceof Error ? error : new Error(message);
  }

  if (!response.ok) {
    let errorMessage = `API Request failed with status ${response.status}`;
    try {
      const clonedResponse = typeof response.clone === "function" ? response.clone() : response;
      try {
        const errorJson = (await clonedResponse.json()) as {
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
        // Fall back to reading the response body as text if it's not JSON
        const rawText = await response.text();
        if (rawText && rawText.trim().length > 0 && rawText.length < 500) {
          errorMessage = rawText.trim();
        }
      }
    } catch (readError) {
      logger.warn(
        `Failed to extract error body: ${readError instanceof Error ? readError.message : "unknown"}`,
      );
    }

    logger.error(`Response Error: ${response.status} ${path} — ${errorMessage}`);
    throw new ApiError(errorMessage, response.status);
  }

  logger.info(`Response Success: ${response.status} ${path}`);

  // Handle empty responses or 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    logger.error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : "unknown"}`,
    );
    throw error instanceof Error ? error : new Error("Invalid JSON response from server");
  }
}
