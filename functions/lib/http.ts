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

export function jsonError(
  message: string,
  status: number,
  opts?: { code?: string; details?: unknown; requestId?: string; headers?: HeadersInit },
): Response {
  return jsonResponse<ErrorResponse>(
    {
      success: false,
      error: { message, code: opts?.code, details: opts?.details },
      error_string: message,
      requestId: opts?.requestId,
    },
    { status, headers: opts?.headers },
  );
}

export function getClientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For");
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("User-Agent");
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
