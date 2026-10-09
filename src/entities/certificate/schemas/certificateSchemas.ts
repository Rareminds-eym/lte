import { z } from "zod";
export const certificateFiltersSchema = z
  .object({
    type: z.enum(["course_completion", "role_readiness"]).optional(),
    levelId: z.uuid().optional(),
  })
  .strict();
export const certificateSchema = z.object({
  credentialId: z.string().regex(/^LTE-[0-9A-HJKMNP-TV-Z]{16}$/),
  certificateType: z.enum(["course_completion", "role_readiness"]),
  status: z.enum(["pending_name", "issued", "revoked"]),
  title: z.string(),
  learnerName: z.string().nullable().optional(),
  subtitle: z.string().nullable(),
  levelLabel: z.string().nullable(),
  badge: z.enum(["developing", "skilled", "mastery"]).nullable(),
  completionDate: z.iso.datetime({ offset: true }),
  issuedAt: z.iso.datetime({ offset: true }).nullable(),
  levelId: z.uuid().nullable(),
  roleId: z.uuid().nullable(),
  verifyUrl: z
    .url()
    .refine((value) => /^https?:\/\//.test(value))
    .nullable(),
  downloadable: z.boolean(),
});
export const certificateListSchema = z.object({ certificates: z.array(certificateSchema) });
