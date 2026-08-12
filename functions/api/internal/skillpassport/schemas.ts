import { z } from "zod";

/** Request envelope for the SkillPassport → LTE gateway: { action, requestId, payload }. */
export const EnvelopeSchema = z.object({
  action: z.string().min(1).max(64),
  requestId: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
});
