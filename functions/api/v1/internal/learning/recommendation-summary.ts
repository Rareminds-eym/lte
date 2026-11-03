import { internalEndpoint } from "@functions/lib/catalog/internal-auth";
import { learningRecommendationSummaryPolicy } from "@functions/lib/learningQueries";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import {
  learningRecommendationRequestSchema,
  learningRecommendationSummarySchema,
} from "@functions/schemas/learning";
import { LEARNING_MESSAGES } from "@functions/shared/learningConfig";

export const onRequestPost = internalEndpoint(async (context, body, correlation) => {
  const parsed = learningRecommendationRequestSchema.safeParse(JSON.parse(body));
  if (!parsed.success)
    return Response.json(
      { error: LEARNING_MESSAGES.invalidRecommendationSummary },
      { status: 400 },
    );
  const gateway = createServiceQueryGateway(context.env, correlation);
  const summary = learningRecommendationSummarySchema.parse(
    await gateway.rpc(learningRecommendationSummaryPolicy, {
      args: { p_user: parsed.data.userId, p_policy: parsed.data.evaluationPolicy },
    }),
  );
  if (summary.evaluationPolicy !== parsed.data.evaluationPolicy)
    return Response.json({ error: LEARNING_MESSAGES.evaluationPolicyChanged }, { status: 503 });
  return Response.json(summary);
});
