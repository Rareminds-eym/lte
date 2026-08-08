import {
  getClientIp,
  getUserAgent,
  jsonError,
  jsonResponse,
  readJsonObject,
} from "@functions/lib/http";
import { changeSsoPassword } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, extractBearerToken, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { PasswordChangeSchema } from "./schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth(context.request, context.env);
    const token = extractBearerToken(context.request);
    if (!token) {
      throw new AuthError("Missing bearer token", "UNAUTHORIZED");
    }

    const body = await readJsonObject(context.request);
    const parsed = PasswordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400, {
        code: "VALIDATION_ERROR",
        requestId,
        details: parsed.error.issues,
      });
    }
    const { current_password: currentPassword, new_password: newPassword } = parsed.data;

    const ip = getClientIp(context.request);
    const ua = getUserAgent(context.request);

    const ssoResult = await changeSsoPassword(context.env, {
      current_password: currentPassword,
      new_password: newPassword,
      access_token: token,
      ip,
      ua,
    });

    return jsonResponse({
      success: true,
      message: ssoResult.message || "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to change password via SSO service", error, { requestId });
    return jsonError("Password change failed", 400, {
      code: "PASSWORD_CHANGE_FAILED",
      requestId,
    });
  }
}
