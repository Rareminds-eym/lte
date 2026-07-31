import type {
  AuthSuccessResponse,
  LogoutResponse,
  MeResponse,
  RefreshResponse,
} from "@/shared/types/auth";

async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : response.statusText;
    throw new Error(message);
  }

  return payload as T;
}

const API_VERSION = "v1";
const AUTH_API_PREFIX = `/api/${API_VERSION}/auth`;

export async function exchangeSsoCode(params: {
  code: string;
  state: string;
  redirectUri: string;
  targetNext?: string;
}): Promise<AuthSuccessResponse> {
  const response = await fetch(`${AUTH_API_PREFIX}/sso/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  return parseJsonResponse<AuthSuccessResponse>(response);
}

export async function refreshSession(): Promise<RefreshResponse> {
  const response = await fetch(`${AUTH_API_PREFIX}/refresh`, {
    method: "POST",
    credentials: "include",
  });

  return parseJsonResponse<RefreshResponse>(response);
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${AUTH_API_PREFIX}/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });

  return parseJsonResponse<MeResponse>(response);
}

export async function logoutSession(): Promise<LogoutResponse> {
  const response = await fetch(`${AUTH_API_PREFIX}/logout`, {
    method: "POST",
    credentials: "include",
  });

  return parseJsonResponse<LogoutResponse>(response);
}
