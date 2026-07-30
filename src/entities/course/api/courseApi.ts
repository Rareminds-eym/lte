import { z } from "zod";
import { getLogger } from "@/shared";
import { ApiError, apiFetch } from "@/shared/api";
import type { Course } from "../model/types";

const apiLogger = getLogger("api");

const UserCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  code: z.string().optional(),
  level: z.string().optional(),
  priority: z.string().optional(),
  step: z.number().optional(),
  totalLevels: z.number(),
  currentLevel: z.number(),
  status: z.string(),
  progress: z.number(),
});

const UserCapabilitiesResponseSchema = z.object({
  success: z.literal(true),
  capabilities: z.array(UserCapabilitySchema),
  count: z.number().optional(),
});

type UserCapabilityResponse = z.infer<typeof UserCapabilitySchema>;

async function fetchUserCapabilities(): Promise<UserCapabilityResponse[]> {
  const raw = await apiFetch<unknown>("/api/v1/capabilities/user", {
    method: "GET",
  });

  const parsed = UserCapabilitiesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data.capabilities;
}

function mapCapabilityToCourse(cap: UserCapabilityResponse, index: number): Course {
  const code = cap.code ?? `CAP-${index + 1}`;
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
    targetLevel: cap.level ?? "L3",
    durationHours: 0,
    xp: 0,
    priority: cap.priority ?? "",
    qualified: cap.status === "completed",
  };
}

export async function fetchUserCourses(): Promise<Course[]> {
  apiLogger.info("fetching user courses");
  const capabilities = await fetchUserCapabilities();
  return capabilities.map((cap, i) => mapCapabilityToCourse(cap, i));
}
