import { emitStageCompletedEvent } from "@functions/api/v1/courses/lteSyncQueue";
import type { InternalCorrelation } from "@functions/lib/catalog/internal-auth";
import { learningClaimPolicy, learningFinishPolicy } from "@functions/lib/learningQueries";
import type { QueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { learningDeliveryClaimsSchema } from "@functions/schemas/learning";
import { LEARNING_MESSAGES, LEARNING_POLICY } from "@functions/shared/learningConfig";
import { apiLogger } from "@functions/shared/logger";

export async function dispatchLearningProgress(
  qb: QueryGateway,
  env: LteEnv,
  correlation?: InternalCorrelation,
) {
  const rows = learningDeliveryClaimsSchema.parse(await qb.rpc(learningClaimPolicy, { args: {} }));
  const failures: unknown[] = [];
  for (let offset = 0; offset < rows.length; offset += LEARNING_POLICY.deliveryConcurrency) {
    const results = await Promise.allSettled(
      rows.slice(offset, offset + LEARNING_POLICY.deliveryConcurrency).map(async (row) => {
        const delivered = await emitStageCompletedEvent(qb, env, {
          userId: row.user_id,
          levelId: row.level_id,
          moduleNumber: 0,
          levelCompleted: false,
          status: "in_progress",
          persistedOnly: true,
        });
        await qb.rpc(learningFinishPolicy, {
          args: {
            p_user: row.user_id,
            p_level: row.level_id,
            p_token: row.lease_token,
            p_success: delivered,
          },
        });
      }),
    );
    for (const result of results)
      if (result.status === "rejected") {
        apiLogger.error(LEARNING_MESSAGES.deliveryFailed, result.reason, correlation);
        failures.push(result.reason);
      }
  }
  if (failures.length) throw new AggregateError(failures, LEARNING_MESSAGES.deliveryFailed);
}
