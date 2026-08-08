import { ARTIFACT_LIMITS } from "@functions/lib/artifact-evaluator";
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const completeSubmissionSchema = z.object({
  artifact_id: uuidSchema,
  answers: z
    .array(
      z.object({
        question_id: uuidSchema,
        text_response: z
          .string()
          .trim()
          .max(ARTIFACT_LIMITS.textResponseMaxChars, "Text response is too long.")
          .optional(),
        url_response: z
          .string()
          .trim()
          .url()
          .max(ARTIFACT_LIMITS.urlResponseMaxChars, "URL response is too long.")
          .optional(),
      }),
    )
    .min(1)
    .max(ARTIFACT_LIMITS.maxAnswersPerSubmission, "Too many answers in one submission."),
});

export type CompleteSubmissionInput = z.infer<typeof completeSubmissionSchema>;
