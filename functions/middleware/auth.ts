import type { AuthUser, SsoServiceBinding, VerifiedAuthContext } from "@rareminds-eym/auth-core";
import { createAuth } from "@rareminds-eym/auth-core";
import { validateBackendEnv } from "../lib/env";
import type { LteEnv } from "../lib/types";

let _authInstance: ReturnType<typeof createAuth> | null = null;

export function resetAuthInstance(): void {
  _authInstance = null;
}

function getAuthInstance(env: LteEnv): ReturnType<typeof createAuth> {
  const ssoRpcRaw = env.SSO_SERVICE;
  if (!ssoRpcRaw || typeof ssoRpcRaw !== "object") {
    throw new Error(
      "SSO_SERVICE must be a Service Binding to the SSO worker. Check wrangler.toml.",
    );
  }

  if (_authInstance) return _authInstance;

  validateBackendEnv(env);

  try {
    _authInstance = createAuth({
      sso: ssoRpcRaw as SsoServiceBinding,
      issuer: "sso-api",
      audience: "sso-client",
      approvedOrigins: [
        "https://lte.rareminds.in",
        "http://localhost:8080",
        "http://localhost:8789",
      ],
      csrf: { name: "X-RM-CSRF", value: "1" },
      cookieMaxAgeSeconds: 604800,
      ssoRequestTimeoutMs: 5000,
    });
    return _authInstance;
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
  const auth = getAuthInstance(env);

  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError("Missing bearer token", "UNAUTHORIZED");
  }

  let authedContext: VerifiedAuthContext | null = null;

  const handler = auth.authenticate(
    auth.requireProduct(["lte"], (_req, context) => {
      authedContext = context;
      return Promise.resolve(new Response(null, { status: 200 }));
    }),
  );

  const res = await handler(request);

  if (res.status === 401) {
    throw new AuthError("Invalid or expired token", "UNAUTHORIZED");
  }

  if (res.status === 403) {
    throw new AuthError("LTE access is required", "FORBIDDEN");
  }

  if (res.status !== 200 || !authedContext) {
    throw new AuthError("Invalid or expired token", "UNAUTHORIZED");
  }

  return (authedContext as VerifiedAuthContext).user;
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

export function getAuthUser(context: { data?: Record<string, unknown> }): AuthUser | null {
  const user = context.data?.["user"];
  if (!user || typeof user !== "object" || !("sub" in user)) return null;
  return user as AuthUser;
}
