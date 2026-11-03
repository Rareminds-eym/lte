import { z } from "zod";
import { credentialIdSchema } from "./credentialId";

export interface CertificateEnv {
  requestId?: string;
  traceparent?: string;
}
const nullableUuid = z.uuid().nullable();
const nullableTimestamp = z.iso.datetime({ offset: true }).nullable();
export const certificateRowSchema = z.object({
  id: z.uuid(),
  credential_id: credentialIdSchema,
  supersedes_id: nullableUuid,
  user_id: z.uuid(),
  certificate_type: z.enum(["course_completion", "role_readiness"]),
  status: z.enum(["pending_name", "issued", "revoked"]),
  level_id: nullableUuid,
  role_id: nullableUuid,
  learning_path_id: nullableUuid,
  level_progress_id: nullableUuid,
  learner_name: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  level_label: z.string().nullable(),
  badge: z.enum(["developing", "skilled", "mastery"]).nullable(),
  completion_date: z.iso.datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()),
  issued_at: nullableTimestamp,
  pdf_object_key: z.string().nullable(),
  pdf_template_version: z.number().int().nullable(),
  pdf_generated_at: nullableTimestamp,
  revoked_at: nullableTimestamp,
  revoked_reason: z.string().nullable(),
  revoked_by: nullableUuid,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type CertificateRow = z.infer<typeof certificateRowSchema>;
export const atomicIssueResultSchema = z.object({
  certificate: certificateRowSchema,
  created: z.boolean(),
});
export interface IssueResult {
  certificateId: string;
  credentialId: string;
  status: CertificateRow["status"];
  created: boolean;
}
/** Invalid upstream results are operational failures, not client 400s. */
export function parseCertificateData<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error("Invalid certificate service result", { cause: parsed.error });
  return parsed.data;
}
