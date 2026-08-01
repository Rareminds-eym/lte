import { getLogger } from "../config/logging";
import { ApiError } from "./ApiError";
import { refreshSession } from "./authApi";

const logger = getLogger("apiFetch");

type TokenGetter = () => string | null;

let getToken: TokenGetter = () => null;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Register a callback that returns the current access token.
 * This permits the shared API layer to implicitly inject bearer authorization
 * without directly importing or depending on the session entity layer.
 */
export const registerTokenGetter = (getter: TokenGetter): void => {
  getToken = getter;
};

export interface ApiFetchOptions extends RequestInit {
  _isRetry?: boolean;
}

/**
 * Generic API Fetch client designed for LTE domain requests.
 * Automatically injects authorization headers, logs queries, and handles errors.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
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
    // Industrial grade 401 auto-refresh & single-flight retry interceptor
    if (response.status === 401 && !options._isRetry && !path.includes("/api/v1/auth/")) {
      logger.info(`Received 401 for ${path}. Intercepting for session refresh...`);
      if (!refreshPromise) {
        refreshPromise = refreshSession()
          .then((res) => {
            if (res && typeof res.access_token === "string" && res.access_token.length > 0) {
              logger.info("Session refreshed successfully in apiFetch interceptor");
              return res.access_token;
            }
            return null;
          })
          .catch((err) => {
            logger.warn("Session refresh failed in apiFetch interceptor", err);
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const refreshedToken = await refreshPromise;
      if (refreshedToken) {
        logger.info(`Retrying request ${path} with refreshed access token`);
        const retryHeaders = new Headers(options.headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
        return apiFetch<T>(path, {
          ...options,
          headers: retryHeaders,
          _isRetry: true,
        });
      }
    }
    let errorMessage = `API Request failed with status ${response.status}`;
    try {
      const clonedResponse = typeof response.clone === "function" ? response.clone() : response;
      try {
        const errorJson = (await clonedResponse.json()) as unknown;
        if (errorJson && typeof errorJson === "object") {
          const record = errorJson as { message?: unknown; error?: unknown };
          if (typeof record.message === "string") {
            errorMessage = record.message;
          } else if (record.error) {
            if (typeof record.error === "string") {
              errorMessage = record.error;
            } else if (typeof record.error === "object" && record.error !== null) {
              const innerError = record.error as { message?: unknown };
              if (typeof innerError.message === "string") {
                errorMessage = innerError.message;
              }
            }
          }
        }
      } catch {
        // Fall back to reading the response body as text if it's not JSON
        const rawText = await clonedResponse.text();
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
