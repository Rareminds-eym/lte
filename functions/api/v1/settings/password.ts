import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, extractBearerToken, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import type { SsoServiceBinding } from "@rareminds-eym/auth-core";
import { PasswordChangeSchema } from "./schemas";

type PasswordSsoService = SsoServiceBinding & {
  changePassword?: (input: {
    current_password: string;
    new_password: string;
    access_token: string;
  }) => Promise<{ success?: boolean; message?: string }>;
};

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

    const ssoService = context.env.SSO_SERVICE as PasswordSsoService;
    if (!ssoService) {
      throw new Error("SSO_SERVICE binding is not configured.");
    }

    let ssoResult: { success?: boolean; message?: string } = { success: true };
    if (typeof ssoService.changePassword === "function") {
      ssoResult = await ssoService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        access_token: token,
      });
    }

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
