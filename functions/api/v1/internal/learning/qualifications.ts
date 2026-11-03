import { internalEndpoint } from "@functions/lib/catalog/internal-auth";
import { learningSnapshotPolicy } from "@functions/lib/learningQueries";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { learningSnapshotSchema, qualificationsRequestSchema } from "@functions/schemas/learning";
import { LEARNING_MESSAGES } from "@functions/shared/learningConfig";

/** Signed server-only read. Catalog requests never return learner evidence. */
export const onRequestPost = internalEndpoint(async (context, body, correlation) => {
  const parsed = qualificationsRequestSchema.safeParse(JSON.parse(body));
  if (!parsed.success)
    return Response.json({ error: LEARNING_MESSAGES.invalidQualification }, { status: 400 });
  const qb = createServiceQueryGateway(context.env, correlation);
  const snapshot = learningSnapshotSchema.parse(
    await qb.rpc(learningSnapshotPolicy, {
      args: {
        p_user: parsed.data.userId,
        p_levels: parsed.data.levelIds,
        p_policy: parsed.data.evaluationPolicy,
      },
    }),
  );
  return Response.json(snapshot);
});
