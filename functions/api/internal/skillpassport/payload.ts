import type { UserCapability } from "@functions/api/v1/capabilities/types";

/** The trimmed per-course payload returned to SkillPassport. */
export interface SyncCapability {
  id: string;
  code?: string;
  name: string;
  description: string;
  status: string;
  currentLevel: number;
  totalLevels: number;
  durationHours: number;
  roleName?: string;
  resumeUrl?: string;
}

/**
 * Trim a learner's capabilities to the SkillPassport sync payload, building each
 * `resumeUrl` deep-link against the request origin. When the origin is empty,
 * `resumeUrl` is omitted rather than emitting a broken relative URL.
 */
export function mapCapabilitiesToSyncPayload(
  capabilities: UserCapability[],
  ltePublicUrl?: string,
): SyncCapability[] {
  const base = (ltePublicUrl ?? "").replace(/\/+$/, "");
  return capabilities.map((cap) => ({
    id: cap.id,
    code: cap.code,
    name: cap.name,
    description: cap.description,
    status: cap.status,
    currentLevel: cap.currentLevel,
    totalLevels: cap.totalLevels,
    durationHours: cap.durationHours,
    roleName: cap.roleName,
    resumeUrl: base ? `${base}/my-courses/${encodeURIComponent(cap.code ?? cap.id)}` : undefined,
  }));
}
