import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const completeSubmissionSchema = z.object({
  artifact_id: uuidSchema,
  answers: z
    .array(
      z.object({
        question_id: uuidSchema,
        text_response: z.string().trim().optional(),
        url_response: z.string().trim().url().optional(),
      }),
    )
    .min(1),
});

export type CompleteSubmissionInput = z.infer<typeof completeSubmissionSchema>;
