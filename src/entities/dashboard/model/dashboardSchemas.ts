import { z } from "zod";

export const DashboardXpResponseSchema = z.object({
  success: z.literal(true),
  totalXp: z.number(),
  xpThisWeek: z.number(),
  todayXp: z.number(),
  todayEvents: z
    .array(
      z.object({
        id: z.string(),
        event_type: z.string(),
        xp_amount: z.number(),
        metadata: z.record(z.string(), z.unknown()),
      }),
    )
    .optional(),
});

export const DashboardStreakResponseSchema = z.object({
  success: z.literal(true),
  streakDays: z.number(),
});

export const DashboardJourneyResponseSchema = z.object({
  success: z.literal(true),
  state: z.enum(["active", "completed", "no_track"]),
  data: z
    .object({
      title: z.string(),
      moduleInfo: z.string(),
      capability: z.string(),
      output: z.string(),
      whyItMatters: z.string(),
      progressPercentage: z.number(),
      completedCount: z.number(),
      inProgressCount: z.number(),
      remainingCount: z.number(),
      // backend never sends it today; JourneyHero guards with `&&`
      timeRemaining: z.string().nullable().optional(),
      levelId: z.string().optional(),
      moduleNo: z.number().optional(),
      capabilityCode: z.string().optional(),
    })
    .nullable(),
});

export const DashboardFeedbackResponseSchema = z.object({
  success: z.literal(true),
  upcoming: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string(),
      tag: z.string(),
      type: z.literal("staff-review"),
      href: z.string().startsWith("/"),
    }),
  ),
  recentFeedback: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string(),
      daysAgo: z.string(),
      type: z.literal("staff-review"),
      href: z.string().startsWith("/"),
    }),
  ),
});
