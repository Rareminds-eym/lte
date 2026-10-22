import { internalEndpoint } from "@functions/lib/catalog/internal-auth";
import { dispatchReviewWork } from "@functions/lib/human-review/dispatch";
import { dispatchLearningProgress } from "@functions/lib/learningProgressDelivery";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import { LEARNING_MESSAGES } from "@functions/shared/learningConfig";
import { apiLogger } from "@functions/shared/logger";

/** Failures in review transport must not prevent independent progress recovery. */
export async function runLearningMaintenanceTasks(
  env: Parameters<typeof createServiceQueryGateway>[0],
  correlation?: Parameters<typeof createServiceQueryGateway>[1],
) {
  const qb = createServiceQueryGateway(env, correlation);
  const results = await Promise.allSettled([
    dispatchReviewWork(env, correlation),
    dispatchLearningProgress(qb, env, correlation),
  ]);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length) {
    for (const error of failures)
      apiLogger.error(LEARNING_MESSAGES.maintenanceFailed, error, correlation);
    throw new AggregateError(failures, LEARNING_MESSAGES.maintenanceFailed);
  }
}
/** Invoked by the authenticated scheduled sync consumer; leases are DB-owned. */
export const onRequestPost = internalEndpoint(async (context, _body, correlation) => {
  await runLearningMaintenanceTasks(context.env, correlation);
  return Response.json({ ok: true });
});
