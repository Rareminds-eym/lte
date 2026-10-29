import { LEARNING_POLICY } from "@functions/shared/learningConfig";
import { z } from "zod";

const fingerprint = z.string().regex(/^[a-f0-9]{32}$/);
export const qualificationsRequestSchema = z
  .object({
    userId: z.uuid().nullable(),
    levelIds: z.array(z.uuid()).max(LEARNING_POLICY.maxRequestedLevels).nullable(),
    evaluationPolicy: z.enum(["human", "ai"]).default("human"),
  })
  .strict();
export const equivalenceRequestSchema = z
  .object({
    levelId: z.uuid(),
    fingerprint,
    evidenceContent: z
      .string()
      .trim()
      .min(LEARNING_POLICY.minEvidenceChars)
      .max(LEARNING_POLICY.maxEvidenceChars),
  })
  .strict();
const evidenceSchema = z.object({
  submissionId: z.uuid(),
  reviewId: z.uuid().nullable(),
  reviewVersion: z.number().int().positive().nullable(),
  evaluationId: z.uuid(),
  evaluationType: z.enum(["ai", "staff_review"]),
  reviewedAt: z.iso.datetime({ offset: true }),
});
export const learningSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  evaluationPolicy: z.enum(["human", "ai"]),
  revision: fingerprint,
  levels: z
    .array(
      z.object({
        levelId: z.uuid(),
        capabilityId: z.uuid(),
        capabilityName: z.string(),
        title: z.string(),
        code: z.string(),
        levelNumber: z.number().int().min(1).max(5),
        version: z.number().int().positive(),
        fingerprint,
        approved: z.boolean(),
        evidence: z.array(evidenceSchema),
      }),
    )
    .max(LEARNING_POLICY.maxSnapshotLevels),
});
export const learningCriteriaSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  observable_behavior: z.json(),
});
export const learningDeliveryClaimsSchema = z
  .array(
    z.object({
      user_id: z.uuid(),
      level_id: z.uuid(),
      lease_token: z.uuid(),
    }),
  )
  .max(LEARNING_POLICY.claimBatchSize);

export const learningRecommendationRequestSchema = z
  .object({ userId: z.uuid(), evaluationPolicy: z.enum(["human", "ai"]) })
  .strict();
export const learningRecommendationSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluationPolicy: z.enum(["human", "ai"]),
    revision: fingerprint,
    truncated: z.boolean(),
    levels: z
      .array(
        z
          .object({
            levelId: z.uuid(),
            capabilityName: z.string().min(1).max(LEARNING_POLICY.maxCapabilityNameChars),
            title: z.string().min(1).max(LEARNING_POLICY.maxLevelTitleChars),
            levelNumber: z
              .number()
              .int()
              .min(LEARNING_POLICY.minLevelNumber)
              .max(LEARNING_POLICY.maxLevelNumber),
            fingerprint,
          })
          .strict(),
      )
      .max(LEARNING_POLICY.maxRecommendationLevels),
  })
  .strict();
