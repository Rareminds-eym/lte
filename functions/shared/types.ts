import type { MembershipStatus } from "@rareminds-eym/auth-core";

export interface R2BucketBinding {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: unknown,
  ): Promise<unknown>;
  get(key: string, options?: unknown): Promise<unknown>;
  head(key: string): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface AssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface LteEnv {
  ASSETS: AssetsBinding;
  SSO_SERVICE: unknown;
  STORAGE_BUCKET: R2BucketBinding;
  R2_PUBLIC_DOMAIN?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  COOKIE_DOMAIN?: string;
  SKILLPASSPORT_INTERNAL_URL: string;
  SKILLPASSPORT_INTERNAL_SECRET: string;
  OPENROUTER_API_KEY?: string;
}

export interface SsoSubscriptionSnapshot {
  id: string;
  user_id: string;
  organization_id: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  plan_type: string | null;
  plan_amount: number | null;
  billing_cycle: string | null;
  status: string;
  features: unknown[];
  product_code: string;
  product_id: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  updated_at: string | null;
}

export interface PagesContext<Env = LteEnv> {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: RequestInfo, init?: RequestInit) => Promise<Response>;
  data?: Record<string, unknown>;
}

export interface AuthApiUser {
  id: string;
  email: string;
  org_id: string;
  roles: string[];
  products: string[];
  membership_status: MembershipStatus;
  is_email_verified: boolean;
  user_metadata: Record<string, unknown>;
}

export interface AuthSuccessResponse {
  access_token: string;
  user: AuthApiUser;
  expires_in: number;
}

export interface ErrorResponse {
  success: false;
  error: { message: string; code?: string; details?: unknown };
  error_string?: string;
  requestId?: string;
}

export interface SsoExchangeResponse {
  access_token: string;
  refresh_token: string;
  user: {
    sub: string;
    email: string;
    org_id: string;
    roles: string[];
    products: string[];
    membership_status: MembershipStatus;
    is_email_verified: boolean;
    user_metadata: Record<string, unknown>;
  };
  subscription: SsoSubscriptionSnapshot | null;
  expires_in?: number;
}

export interface SsoServiceBinding {
  getJwks(input: { correlationId: string }): Promise<unknown>;
  exchangeAuthorizationCode(params: {
    code: string;
    state: string;
    redirectUri: string;
    targetApp: string;
    ip?: string;
    ua?: string;
  }): Promise<SsoExchangeResponse>;
  [key: string]: unknown;
}
