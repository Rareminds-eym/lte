import type { QueryGateway } from "@functions/lib/query-gateway";
import { z } from "zod";

const scoreRows = z
  .array(
    z.object({
      id: z.string(),
      label: z.string(),
      maxScore: z.literal(3),
      score: z.number().int().min(0).max(3),
      evidence: z.string(),
      feedback: z.string(),
      tone: z.enum(["success", "warning", "error"]),
    }),
  )
  .length(5);

/** Call only after submission ownership has been checked by the caller. */
export async function readStaffRubricRows(
  qb: QueryGateway,
  submissionId: string,
  learnerId: string,
) {
  const rows = await qb.rpc(
    {
      operation: "rpc",
      functionName: "read_review_criterion_scores",
      allowedArgs: ["p_submission_id", "p_learner_id"],
    },
    { args: { p_submission_id: submissionId, p_learner_id: learnerId } },
  );
  return scoreRows.parse(rows);
}
