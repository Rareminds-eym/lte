import type { AuthUser, MembershipStatus } from "@rareminds-eym/auth-core";

export interface LteEnv {
  SSO_SERVICE: SsoRpcService;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  COOKIE_DOMAIN?: string;
}

export interface PagesContext<Env = LteEnv> {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  data?: Record<string, unknown>;
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

export interface SsoExchangeResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  subscription: SsoSubscriptionSnapshot | null;
  expires_in: number;
}

export interface SsoRpcService {
  getMe(accessToken: string): Promise<Record<string, unknown>>;
  refreshSession(
    refreshToken: string,
    ip?: string,
    ua?: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
  }>;
  logoutSession(
    refreshToken: string,
    ip?: string,
    ua?: string,
  ): Promise<{
    success: boolean;
  }>;
  exchangeAuthorizationCode(params: {
    code: string;
    state: string;
    redirectUri: string;
    targetApp: "lte";
    ip?: string | null;
    ua?: string | null;
  }): Promise<SsoExchangeResponse>;
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
