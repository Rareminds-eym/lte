import { z } from "zod";

export const certificateCleanupRequestSchema = z.object({}).strict();
export const internalQuerySchema = z
  .object({
    userId: z.uuid().optional(),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict()
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.updatedSince),
    "Provide userId or updatedSince",
  );
export const certificateCursorSchema = z
  .object({
    updatedAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
  })
  .strict();
