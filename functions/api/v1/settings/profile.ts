import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";

export interface SettingsProfileResponse {
  success: boolean;
  profile: {
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    program: string;
    gradeSemester: string;
    learnerId: string;
    college: string;
    section: string;
    skillPassportVerified: boolean;
    twoFactorEnabled: boolean;
    loginAlertsEnabled: boolean;
    profileStrength: number;
  };
}

function calculateProfileStrength(profile: Record<string, unknown>): number {
  const fields = [
    "fullName",
    "email",
    "phone",
    "program",
    "gradeSemester",
    "college",
    "section",
    "learnerId",
  ];
  let filled = 0;
  for (const field of fields) {
    const val = profile[field];
    if (typeof val === "string" && val.trim().length > 0) {
      filled++;
    } else if (typeof val === "boolean" && val) {
      filled++;
    }
  }
  return Math.round((filled / fields.length) * 100);
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const supabase = createServiceSupabase(context.env);

    const { data: dbUser, error } = await supabase
      .from("users")
      .select("first_name, last_name, email, phone, metadata")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const metadata = (dbUser?.metadata ?? user.user_metadata ?? {}) as Record<string, unknown>;

    const firstName =
      dbUser?.first_name ||
      (typeof metadata["firstName"] === "string" ? metadata["firstName"] : "") ||
      (typeof metadata["first_name"] === "string" ? metadata["first_name"] : "");
    const lastName =
      dbUser?.last_name ||
      (typeof metadata["lastName"] === "string" ? metadata["lastName"] : "") ||
      (typeof metadata["family_name"] === "string" ? metadata["family_name"] : "");

    const fullNameCandidate = `${firstName} ${lastName}`.trim();
    const fullName =
      fullNameCandidate ||
      (typeof metadata["full_name"] === "string" ? metadata["full_name"] : "") ||
      (typeof metadata["name"] === "string" ? metadata["name"] : "");

    const email = dbUser?.email || user.email || "";
    const phone =
      dbUser?.phone ||
      (typeof metadata["phone"] === "string" ? metadata["phone"] : "") ||
      (typeof metadata["phone_number"] === "string" ? metadata["phone_number"] : "");

    const program =
      (typeof metadata["program"] === "string" ? metadata["program"] : "") ||
      (typeof metadata["degree"] === "string" ? metadata["degree"] : "") ||
      (typeof metadata["course"] === "string" ? metadata["course"] : "");

    const gradeSemester =
      (typeof metadata["gradeSemester"] === "string" ? metadata["gradeSemester"] : "") ||
      (typeof metadata["grade"] === "string" ? metadata["grade"] : "") ||
      (typeof metadata["semester"] === "string" ? metadata["semester"] : "");

    const learnerId =
      (typeof metadata["learnerId"] === "string" ? metadata["learnerId"] : "") ||
      (typeof metadata["learner_id"] === "string" ? metadata["learner_id"] : "") ||
      userId;

    const college =
      (typeof metadata["college"] === "string" ? metadata["college"] : "") ||
      (typeof metadata["institution"] === "string" ? metadata["institution"] : "") ||
      (typeof metadata["university"] === "string" ? metadata["university"] : "");

    const section = typeof metadata["section"] === "string" ? metadata["section"] : "";

    const skillPassportVerified =
      metadata["skillPassportVerified"] === true || metadata["skill_passport_verified"] === true;

    const twoFactorEnabled = metadata["twoFactorEnabled"] === true;
    const loginAlertsEnabled = metadata["loginAlertsEnabled"] !== false;

    const rawProfile = {
      fullName,
      firstName,
      lastName,
      email,
      phone,
      program,
      gradeSemester,
      learnerId,
      college,
      section,
      skillPassportVerified,
      twoFactorEnabled,
      loginAlertsEnabled,
    };

    const profileStrength = calculateProfileStrength(rawProfile);

    return jsonResponse<SettingsProfileResponse>({
      success: true,
      profile: {
        ...rawProfile,
        profileStrength,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch settings profile", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}

export async function onRequestPut(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const body = await readJsonObject(context.request);
    const supabase = createServiceSupabase(context.env);

    // Fetch existing metadata to merge
    const { data: existingUser } = await supabase
      .from("users")
      .select("first_name, last_name, phone, metadata")
      .eq("id", userId)
      .maybeSingle();

    const existingMetadata = (existingUser?.metadata ?? {}) as Record<string, unknown>;

    let firstName = existingUser?.first_name ?? "";
    let lastName = existingUser?.last_name ?? "";

    const bodyFullName = typeof body["fullName"] === "string" ? body["fullName"] : "";
    const bodyFirstName = typeof body["firstName"] === "string" ? body["firstName"] : "";
    const bodyLastName = typeof body["lastName"] === "string" ? body["lastName"] : "";
    const bodyPhone = typeof body["phone"] === "string" ? body["phone"] : "";
    const bodyProgram = typeof body["program"] === "string" ? body["program"] : "";
    const bodyGradeSemester =
      typeof body["gradeSemester"] === "string" ? body["gradeSemester"] : "";
    const bodyCollege = typeof body["college"] === "string" ? body["college"] : "";
    const bodySection = typeof body["section"] === "string" ? body["section"] : "";
    const bodyTwoFactor =
      typeof body["twoFactorEnabled"] === "boolean" ? body["twoFactorEnabled"] : undefined;
    const bodyLoginAlerts =
      typeof body["loginAlertsEnabled"] === "boolean" ? body["loginAlertsEnabled"] : undefined;

    if (bodyFullName.trim().length > 0) {
      const parts = bodyFullName.trim().split(" ");
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    } else {
      if (bodyFirstName.trim().length > 0) firstName = bodyFirstName.trim();
      if (bodyLastName.trim().length > 0) lastName = bodyLastName.trim();
    }

    const phone = bodyPhone.trim().length > 0 ? bodyPhone.trim() : (existingUser?.phone ?? null);

    const updatedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      ...(bodyProgram.trim().length > 0 ? { program: bodyProgram.trim() } : {}),
      ...(bodyGradeSemester.trim().length > 0 ? { gradeSemester: bodyGradeSemester.trim() } : {}),
      ...(bodyCollege.trim().length > 0 ? { college: bodyCollege.trim() } : {}),
      ...(bodySection.trim().length > 0 ? { section: bodySection.trim() } : {}),
      ...(bodyTwoFactor !== undefined ? { twoFactorEnabled: bodyTwoFactor } : {}),
      ...(bodyLoginAlerts !== undefined ? { loginAlertsEnabled: bodyLoginAlerts } : {}),
    };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        metadata: updatedMetadata,
        updated_at: now,
      })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const email = user.email;
    const program =
      typeof updatedMetadata["program"] === "string" ? updatedMetadata["program"] : "";
    const gradeSemester =
      typeof updatedMetadata["gradeSemester"] === "string" ? updatedMetadata["gradeSemester"] : "";
    const learnerId =
      typeof updatedMetadata["learnerId"] === "string" ? updatedMetadata["learnerId"] : userId;
    const college =
      typeof updatedMetadata["college"] === "string" ? updatedMetadata["college"] : "";
    const section =
      typeof updatedMetadata["section"] === "string" ? updatedMetadata["section"] : "";
    const skillPassportVerified =
      updatedMetadata["skillPassportVerified"] === true ||
      updatedMetadata["skill_passport_verified"] === true;
    const twoFactorEnabled = updatedMetadata["twoFactorEnabled"] === true;
    const loginAlertsEnabled = updatedMetadata["loginAlertsEnabled"] !== false;

    const rawProfile = {
      fullName,
      firstName,
      lastName,
      email,
      phone: phone ?? "",
      program,
      gradeSemester,
      learnerId,
      college,
      section,
      skillPassportVerified,
      twoFactorEnabled,
      loginAlertsEnabled,
    };

    const profileStrength = calculateProfileStrength(rawProfile);

    return jsonResponse<SettingsProfileResponse>({
      success: true,
      profile: {
        ...rawProfile,
        profileStrength,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to update settings profile", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
