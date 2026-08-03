import { AuthError, extractBearerToken, requireAuth } from "@functions/lib/auth";
import {
  getClientIp,
  getUserAgent,
  jsonError,
  jsonResponse,
  readJsonObject,
} from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { changeSsoPassword } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requireAuth(context.request, context.env);
    const token = extractBearerToken(context.request);
    if (!token) {
      throw new AuthError("Missing bearer token", "UNAUTHORIZED");
    }

    const body = await readJsonObject(context.request);
    const currentPassword = body["current_password"] as string;
    const newPassword = body["new_password"] as string;

    if (!currentPassword || typeof currentPassword !== "string") {
      return jsonError("Current password is required", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return jsonError("New password must be at least 8 characters", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

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
    const message = error instanceof Error ? error.message : "Failed to change password";
    return jsonError(message, 400, { code: "PASSWORD_CHANGE_FAILED", requestId });
  }
}
