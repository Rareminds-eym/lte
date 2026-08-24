import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { ProfileUpdateSchema } from "./schemas";

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

interface UserMetadata extends Record<string, unknown> {
  skillPassportVerified?: unknown;
  skill_passport_verified?: unknown;
  twoFactorEnabled?: unknown;
  loginAlertsEnabled?: unknown;
}

interface SettingsUserRow {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone: string | null;
  metadata: UserMetadata | null;
}

const settingsUserReadPolicy = {
  table: "users",
  operation: "read",
  columns: ["first_name", "last_name", "email", "phone", "metadata"],
  filters: ["id"],
  ownership: {
    column: "id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const settingsUserUpdatePolicy = {
  table: "users",
  operation: "update",
  updateColumns: ["first_name", "last_name", "phone", "metadata", "updated_at"],
  filters: ["id"],
  requireFilter: true,
  ownership: {
    column: "id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const profileCompletionXpInsertPolicy = {
  table: "xp_events",
  operation: "insert",
  insertColumns: [
    "user_id",
    "event_type",
    "xp_category",
    "xp_amount",
    "source_type",
    "source_id",
    "idempotency_key",
    "metadata",
  ],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

function getMetaString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return "";
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
    }
  }
  return Math.round((filled / fields.length) * 100);
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const qb = createServiceQueryGateway(context.env);
    const dbUser = (await qb.read(settingsUserReadPolicy, {
      auth: { userId },
      result: "maybeSingle",
    })) as SettingsUserRow | null;

    const metadata = (dbUser?.metadata ?? user.user_metadata ?? {}) as UserMetadata;

    const firstName = dbUser?.first_name || getMetaString(metadata, ["firstName", "first_name"]);
    const lastName = dbUser?.last_name || getMetaString(metadata, ["lastName", "family_name"]);

    const fullNameCandidate = `${firstName} ${lastName}`.trim();
    const fullName = fullNameCandidate || getMetaString(metadata, ["full_name", "name"]);

    const email = dbUser?.email || user.email || "";
    const phone = dbUser?.phone || getMetaString(metadata, ["phone", "phone_number"]);
    const program = getMetaString(metadata, ["program", "degree", "course"]);
    const gradeSemester = getMetaString(metadata, ["gradeSemester", "grade", "semester"]);
    const learnerId = getMetaString(metadata, ["learnerId", "learner_id"]) || userId;
    const college = getMetaString(metadata, ["college", "institution", "university"]);
    const section = getMetaString(metadata, ["section"]);

    const skillPassportVerified =
      metadata.skillPassportVerified === true || metadata.skill_passport_verified === true;
    const twoFactorEnabled = metadata.twoFactorEnabled === true;
    const loginAlertsEnabled = metadata.loginAlertsEnabled === true;

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
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}

export async function onRequestPut(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    const body = await readJsonObject(context.request);
    const parsed = ProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400, {
        code: "VALIDATION_ERROR",
        requestId,
        details: parsed.error.issues,
      });
    }

    const qb = createServiceQueryGateway(context.env);

    // Fetch existing metadata to merge
    const existingUser = (await qb.read(settingsUserReadPolicy, {
      auth: { userId },
      result: "maybeSingle",
    })) as SettingsUserRow | null;

    const existingMetadata = (existingUser?.metadata ?? {}) as UserMetadata;

    let firstName = existingUser?.first_name ?? "";
    let lastName = existingUser?.last_name ?? "";

    const bodyFullName = parsed.data.fullName ?? "";
    const bodyFirstName = parsed.data.firstName ?? "";
    const bodyLastName = parsed.data.lastName ?? "";
    const bodyPhone = parsed.data.phone ?? "";
    const bodyProgram = parsed.data.program ?? "";
    const bodyGradeSemester = parsed.data.gradeSemester ?? "";
    const bodyCollege = parsed.data.college ?? "";
    const bodySection = parsed.data.section ?? "";
    const bodyTwoFactor = parsed.data.twoFactorEnabled;
    const bodyLoginAlerts = parsed.data.loginAlertsEnabled;

    if (bodyFullName.length > 0) {
      const parts = bodyFullName.split(" ");
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    } else {
      if (bodyFirstName.length > 0) firstName = bodyFirstName;
      if (bodyLastName.length > 0) lastName = bodyLastName;
    }

    const phone = bodyPhone.length > 0 ? bodyPhone : (existingUser?.phone ?? null);

    const updatedMetadata: UserMetadata = {
      ...existingMetadata,
      ...(bodyProgram.length > 0 ? { program: bodyProgram } : {}),
      ...(bodyGradeSemester.length > 0 ? { gradeSemester: bodyGradeSemester } : {}),
      ...(bodyCollege.length > 0 ? { college: bodyCollege } : {}),
      ...(bodySection.length > 0 ? { section: bodySection } : {}),
      ...(bodyTwoFactor !== undefined ? { twoFactorEnabled: bodyTwoFactor } : {}),
      ...(bodyLoginAlerts !== undefined ? { loginAlertsEnabled: bodyLoginAlerts } : {}),
    };

    const now = new Date().toISOString();
    await qb.update(settingsUserUpdatePolicy, {
      auth: { userId },
      data: {
        first_name: firstName,
        last_name: lastName,
        phone,
        metadata: updatedMetadata,
        updated_at: now,
      },
    });

    const fullName = `${firstName} ${lastName}`.trim();
    const email = user.email;
    const program = getMetaString(updatedMetadata, ["program"]);
    const gradeSemester = getMetaString(updatedMetadata, ["gradeSemester"]);
    const learnerId = getMetaString(updatedMetadata, ["learnerId"]) || userId;
    const college = getMetaString(updatedMetadata, ["college"]);
    const section = getMetaString(updatedMetadata, ["section"]);
    const skillPassportVerified =
      updatedMetadata.skillPassportVerified === true ||
      updatedMetadata.skill_passport_verified === true;
    const twoFactorEnabled = updatedMetadata.twoFactorEnabled === true;
    const loginAlertsEnabled = updatedMetadata.loginAlertsEnabled !== false;

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

    // Background task: award +50 XP when profile reaches 100% completion.
    // Idempotency key (profile:{userId}) ensures this is only ever awarded once.
    if (profileStrength === 100) {
      const task = completeProfile(supabase, userId).catch((err) => {
        apiLogger.error("[XP] profile_completed award failed", err, { userId });
      });
      if (typeof context.waitUntil === "function") {
        context.waitUntil(task);
      }
    }

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
    return jsonError("Internal server error", 500, { code: "SERVER_ERROR", requestId });
  }
}
