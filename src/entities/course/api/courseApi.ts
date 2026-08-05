import { z } from "zod";
import { getLogger } from "@/shared";
import { ApiError, apiFetch } from "@/shared/api";
import type { Course } from "../model/types";

const apiLogger = getLogger("api");

const UserCapabilitySchema = z.object({
  id: z.string(),
  name: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  code: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  level: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  priority: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  step: z
    .number()
    .nullish()
    .transform((v) => v ?? undefined),
  totalLevels: z
    .number()
    .nullish()
    .transform((v) => v ?? 0),
  currentLevel: z
    .number()
    .nullish()
    .transform((v) => v ?? 0),
  status: z
    .string()
    .nullish()
    .transform((v) => v ?? "not_started"),
  progress: z
    .number()
    .nullish()
    .transform((v) => v ?? 0),
  xp: z
    .number()
    .nullish()
    .transform((v) => v ?? 0),
  roleId: z.string().optional(),
  roleName: z.string().optional(),
});

const UserCapabilitiesResponseSchema = z.object({
  success: z.literal(true),
  capabilities: z.array(UserCapabilitySchema),
  count: z.number().optional(),
});

type UserCapabilityResponse = z.infer<typeof UserCapabilitySchema>;

export const CapabilityLevelSchema = z.object({
  id: z.string(),
  levelNumber: z
    .number()
    .nullish()
    .transform((v) => v ?? 1),
  code: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  title: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  description: z
    .array(z.string())
    .or(z.string())
    .nullish()
    .transform((v) => {
      if (!v) return "";
      return Array.isArray(v) ? v.join(" ") : v;
    }),
  deliverables: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
  durationMinutes: z
    .number()
    .nullish()
    .transform((v) => v ?? 0),
  difficulty: z
    .string()
    .nullish()
    .transform((v) => v ?? "intermediate"),
  status: z
    .string()
    .nullish()
    .transform((v) => v ?? "published"),
  totalXp: z
    .number()
    .nullish()
    .transform((v) => v ?? undefined),
});

export type CapabilityLevel = z.infer<typeof CapabilityLevelSchema>;

const CapabilityLevelsResponseSchema = z.object({
  success: z.literal(true),
  capability: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  levels: z.array(CapabilityLevelSchema),
  count: z.number().optional(),
});

async function fetchUserCapabilities(): Promise<UserCapabilityResponse[]> {
  const raw = await apiFetch("/api/v1/capabilities/user", {
    method: "GET",
  });

  const parsed = UserCapabilitiesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    apiLogger.error("Failed to parse user capabilities response", parsed.error);
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data.capabilities;
}

function mapCapabilityToCourse(cap: UserCapabilityResponse, index: number): Course {
  const code = cap.code ?? `CAP-${index + 1}`;
  const targetLevel = (cap.level ?? "L3").replace(/^target:\s*/i, "");
  return {
    id: cap.id,
    capabilityId: cap.id,
    capabilityCode: code,
    title: cap.name,
    description: cap.description,
    category: cap.priority ?? "",
    level: cap.level ?? "",
    imageUrl: `https://picsum.photos/seed/${code}/400/220`,
    tags: [],
    status: cap.status as Course["status"],
    progress: cap.progress,
    currentLevel: cap.currentLevel,
    totalLevels: cap.totalLevels,
    targetLevel,
    durationHours: 0,
    xp: cap.xp ?? 0,
    priority: cap.priority ?? "",
    qualified: cap.status === "completed",
    roleId: cap.roleId,
    roleName: cap.roleName,
  };
}

export async function fetchUserCourses(): Promise<Course[]> {
  apiLogger.info("fetching user courses");
  const capabilities = await fetchUserCapabilities();
  return capabilities.map((cap, i) => mapCapabilityToCourse(cap, i));
}

export async function fetchCapabilityLevels(capabilityCode: string): Promise<CapabilityLevel[]> {
  const raw = await apiFetch(`/api/v1/capabilities/${encodeURIComponent(capabilityCode)}/levels`, {
    method: "GET",
  });

  const parsed = CapabilityLevelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data.levels;
}
