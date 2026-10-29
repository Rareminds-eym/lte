import { internalEndpoint } from "@functions/lib/catalog/internal-auth";
import { learningRecommendationSummaryPolicy } from "@functions/lib/learningQueries";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { z } from "zod";

const requestSchema = z
  .object({ userId: z.uuid(), evaluationPolicy: z.enum(["human", "ai"]) })
  .strict();
const summarySchema = z
  .object({
    schemaVersion: z.literal(1),
    evaluationPolicy: z.enum(["human", "ai"]),
    revision: z.string().regex(/^[a-f0-9]{32}$/),
    truncated: z.boolean(),
    levels: z
      .array(
        z
          .object({
            levelId: z.uuid(),
            capabilityName: z.string().min(1).max(300),
            title: z.string().min(1).max(500),
            levelNumber: z.number().int().min(1).max(5),
            fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export const onRequestPost = internalEndpoint(async (context, body, correlation) => {
  const parsed = requestSchema.safeParse(JSON.parse(body));
  if (!parsed.success)
    return Response.json({ error: "Invalid learning summary request." }, { status: 400 });
  const gateway = createServiceQueryGateway(context.env, correlation);
  const summary = summarySchema.parse(
    await gateway.rpc(learningRecommendationSummaryPolicy, {
      args: { p_user: parsed.data.userId, p_policy: parsed.data.evaluationPolicy },
    }),
  );
  if (summary.evaluationPolicy !== parsed.data.evaluationPolicy)
    return Response.json({ error: "Learning evaluation policy changed." }, { status: 503 });
  return Response.json(summary);
});
