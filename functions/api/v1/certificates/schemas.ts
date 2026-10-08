import { credentialIdSchema } from "@functions/lib/certificates/credential-id";
import { z } from "zod";
export const certificateTypeSchema = z.enum(["course_completion", "role_readiness"]);
export const listQuerySchema = z
  .object({ type: certificateTypeSchema.optional(), levelId: z.uuid().optional() })
  .strict();
export const certificateSummarySchema = z.object({
  credentialId: credentialIdSchema,
  certificateType: certificateTypeSchema,
  status: z.enum(["pending_name", "issued", "revoked"]),
  title: z.string(),
  subtitle: z.string().nullable(),
  levelLabel: z.string().nullable(),
  badge: z.enum(["developing", "skilled", "mastery"]).nullable(),
  completionDate: z.iso.datetime({ offset: true }),
  issuedAt: z.iso.datetime({ offset: true }).nullable(),
  levelId: z.uuid().nullable(),
  roleId: z.uuid().nullable(),
  verifyUrl: z.url().nullable(),
  downloadable: z.boolean(),
});
export const listResponseSchema = z.object({ certificates: z.array(certificateSummarySchema) });
export const verifyResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("valid"),
    credentialId: credentialIdSchema,
    issuer: z.literal("Rareminds LTE"),
    certificateType: certificateTypeSchema,
    learnerName: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
    levelLabel: z.string().nullable(),
    badge: z.string().nullable(),
    completionDate: z.iso.datetime({ offset: true }),
    issuedAt: z.iso.datetime({ offset: true }),
  }),
  z.object({
    status: z.literal("revoked"),
    credentialId: credentialIdSchema,
    issuer: z.literal("Rareminds LTE"),
    revokedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
  z.object({
    status: z.literal("not_found"),
    credentialId: credentialIdSchema,
    issuer: z.literal("Rareminds LTE"),
  }),
]);
