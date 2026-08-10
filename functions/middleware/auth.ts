import type { AuthUser } from "@rareminds-eym/auth-core";
import { initAuth, verifyJWT } from "@rareminds-eym/auth-core";
import { validateBackendEnv } from "../lib/env";
import type { LteEnv } from "../lib/types";

/**
 * auth-core is initialized once per isolate with the SSO service binding,
 * then verifies JWTs via the SSO worker's JWKS over RPC (no local
 * hand-rolled crypto, no per-request re-initialization).
 */
let _authInitialized = false;

function ensureAuthInitialized(env: LteEnv): void {
  const ssoRpcRaw = env.SSO_SERVICE;
  if (!ssoRpcRaw || typeof ssoRpcRaw !== "object") {
    throw new Error(
      "SSO_SERVICE must be a Service Binding to the SSO worker. Check wrangler.toml.",
    );
  }

  if (_authInitialized) return;

  validateBackendEnv(env);

  try {
    initAuth({ ssoRpc: ssoRpcRaw });
    _authInitialized = true;
  } catch (error) {
    throw new Error(
      `Failed to initialize auth-core: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(request: Request, env: LteEnv): Promise<AuthUser> {
  ensureAuthInitialized(env);

  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError("Missing bearer token", "UNAUTHORIZED");
  }

  let user: AuthUser;
  try {
    user = await verifyJWT(token);
  } catch {
    throw new AuthError("Invalid or expired token", "UNAUTHORIZED");
  }

  if (!user.products.includes("lte")) {
    throw new AuthError("LTE access is required", "FORBIDDEN");
  }
  return user;
}

export function toAuthApiUser(user: AuthUser) {
  return {
    id: user.sub,
    email: user.email,
    org_id: user.org_id,
    roles: user.roles,
    products: user.products,
    membership_status: user.membership_status,
    is_email_verified: user.is_email_verified,
    user_metadata: user.user_metadata ?? {},
  };
}

/**
 * Type-safe accessor for the authenticated user set by _middleware.ts.
 * Returns the full AuthUser from `context.data.user` or null when the
 * middleware hasn't run (should not happen behind _middleware.ts, but
 * the null-check keeps handlers safe if called from a test harness).
 */
export function getAuthUser(context: { data?: Record<string, unknown> }): AuthUser | null {
  const user = context.data?.["user"];
  if (!user || typeof user !== "object" || !("sub" in user)) return null;
  return user as AuthUser;
}
