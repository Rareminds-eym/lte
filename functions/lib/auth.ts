import type { AuthUser } from "@rareminds-eym/auth-core";
import { getMe } from "./sso-client";
import type { LteEnv } from "./types";

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

export async function requireAuth(
  request: Request,
  env: Pick<LteEnv, "SSO_SERVICE">,
): Promise<AuthUser> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError("Missing bearer token", "UNAUTHORIZED");
  }

  try {
    const user = await getMe(env, token);
    if (!user.products.includes("lte")) {
      throw new AuthError("LTE access is required", "FORBIDDEN");
    }
    return user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : "Unauthenticated";
    throw new AuthError(msg, "UNAUTHORIZED");
  }
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
