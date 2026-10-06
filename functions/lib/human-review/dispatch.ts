import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";
import { REVIEW_DEADLINE_BATCH_SIZE, REVIEW_MAINTENANCE_BATCH_SIZE } from "./config";
import { assignmentSchema, ensureAndAssignReview, reviewRpc } from "./service";

const outboxSchema = z.array(
  z.object({
    id: z.uuid(),
    lease_token: z.uuid(),
    event_type: z.string(),
    payload: z.record(z.string(), z.unknown()),
  }),
);
/**
 * One pass of review maintenance: scope re-checks, reconciliation of unassigned
 * reviews, deadline events, and outbox delivery to LTE_SYNC_QUEUE.
 *
 * NOTE: nothing currently calls this. The cron Worker that ran it was removed,
 * so outbox events, reconciliation and deadline reminders do not run until a
 * runner is added.
 */
export async function dispatchReviewWork(env: LteEnv) {
  const qb = createServiceQueryGateway(env);
  const scopeChecks = z
    .array(assignmentSchema)
    .parse(
      await reviewRpc(qb, "claim_review_scope_checks", { p_limit: REVIEW_MAINTENANCE_BATCH_SIZE }),
    );
  for (const assignment of scopeChecks) {
    try {
      await ensureAndAssignReview(
        qb,
        env,
        assignment.submission_id,
        assignment.learner_id,
        "scope_reconciliation",
      );
    } catch (error) {
      apiLogger.error("Review scope reconciliation failed", error, { reviewId: assignment.id });
    }
  }
  const assignments = z.array(assignmentSchema).parse(
    await reviewRpc(qb, "claim_review_reconciliation", {
      p_limit: REVIEW_MAINTENANCE_BATCH_SIZE,
    }),
  );
  for (const assignment of assignments) {
    try {
      await ensureAndAssignReview(
        qb,
        env,
        assignment.submission_id,
        assignment.learner_id,
        "reconciliation",
      );
    } catch (error) {
      apiLogger.error("Review reconciliation failed", error, { reviewId: assignment.id });
    }
  }
  await reviewRpc(qb, "schedule_review_deadlines", { p_limit: REVIEW_DEADLINE_BATCH_SIZE });
  if (!env.LTE_SYNC_QUEUE) throw new Error("LTE_SYNC_QUEUE is required for review dispatch");
  const events = outboxSchema.parse(
    await reviewRpc(qb, "claim_review_outbox", { p_limit: REVIEW_MAINTENANCE_BATCH_SIZE }),
  );
  for (const event of events) {
    let sent = false;
    try {
      await env.LTE_SYNC_QUEUE.send(
        { type: event.event_type, payload: event.payload },
        { contentType: "json" },
      );
      sent = true;
    } catch (error) {
      apiLogger.error("Review event delivery failed", error, { eventId: event.id });
    }
    // A lost acknowledgement leaves a lease; expiry resends the same stable ID.
    await reviewRpc(qb, "finish_review_outbox", {
      p_id: event.id,
      p_lease: event.lease_token,
      p_success: sent,
    });
  }
}
