import type { ErrorResponse } from "./types";

export function jsonResponse<T>(body: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function jsonError(error: string, status: number, init: ResponseInit = {}): Response {
  return jsonResponse<ErrorResponse>({ error }, { ...init, status });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function getClientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For");
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("User-Agent");
}
