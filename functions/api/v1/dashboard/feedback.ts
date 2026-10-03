import { jsonError, jsonResponse } from "@functions/lib/http";
import { assignmentPolicy, assignmentSchema } from "@functions/lib/human-review/service";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    if (context.env.HUMAN_REVIEW_AVAILABLE !== "true") {
      return jsonResponse({ success: true, upcoming: [], recentFeedback: [] });
    }
    const qb = createServiceQueryGateway(context.env);
    const ownedPolicy = {
      ...assignmentPolicy,
      ownership: { column: "learner_id", source: "authenticatedUserId", required: true },
      sorts: ["required_at", "completed_at", "id"],
    } as const;
    const [pending, recent] = await Promise.all([
      qb.read(ownedPolicy, {
        auth: { userId: user.sub },
        filters: [{ column: "status", op: "in", value: ["unassigned", "pending", "in_progress"] }],
        sort: [
          { column: "required_at", ascending: true },
          { column: "id", ascending: true },
        ],
        pageSize: 20,
      }),
      qb.read(ownedPolicy, {
        auth: { userId: user.sub },
        filters: [{ column: "status", op: "in", value: ["completed", "returned"] }],
        sort: [
          { column: "completed_at", ascending: false },
          { column: "id", ascending: true },
        ],
        pageSize: 20,
      }),
    ]);
    const upcoming = z.array(assignmentSchema).parse(pending);
    const completed = z.array(assignmentSchema).parse(recent);
    const all = [...upcoming, ...completed];
    if (!all.length) return jsonResponse({ success: true, upcoming: [], recentFeedback: [] });
    const submissions = z
      .array(z.object({ id: z.uuid(), user_module_progress_id: z.uuid() }))
      .parse(
        await qb.read(
          {
            table: "artifact_submissions",
            operation: "read",
            columns: ["id", "user_module_progress_id"],
            filters: ["id"],
            ownership: { column: "user_id", source: "authenticatedUserId", required: true },
            maxPageSize: 40,
          },
          {
            auth: { userId: user.sub },
            filters: [{ column: "id", op: "in", value: all.map((r) => r.submission_id) }],
            pageSize: 40,
          },
        ),
      );
    const progress = z.array(z.object({ id: z.uuid(), module_id: z.uuid() })).parse(
      await qb.read(
        {
          table: "user_module_progress",
          operation: "read",
          columns: ["id", "module_id"],
          filters: ["id"],
          ownership: { column: "user_id", source: "authenticatedUserId", required: true },
          maxPageSize: 40,
        },
        {
          auth: { userId: user.sub },
          filters: [
            { column: "id", op: "in", value: submissions.map((s) => s.user_module_progress_id) },
          ],
          pageSize: 40,
        },
      ),
    );
    const modules = z
      .array(
        z.object({
          id: z.uuid(),
          level_id: z.uuid(),
          module_no: z.number().int(),
          title: z.string(),
        }),
      )
      .parse(
        await qb.read(
          {
            table: "modules",
            operation: "read",
            columns: ["id", "level_id", "module_no", "title"],
            filters: ["id"],
            maxPageSize: 40,
          },
          {
            filters: [{ column: "id", op: "in", value: progress.map((p) => p.module_id) }],
            pageSize: 40,
          },
        ),
      );
    const contextFor = (submissionId: string) => {
      const submission = submissions.find((s) => s.id === submissionId);
      const moduleProgress = progress.find((p) => p.id === submission?.user_module_progress_id);
      const module = modules.find((m) => m.id === moduleProgress?.module_id);
      if (!module) throw new Error("Missing review learning context");
      return {
        title: module.title,
        href: `/my-courses/${module.level_id}/modules/${module.module_no}`,
      };
    };
    return jsonResponse({
      success: true,
      upcoming: upcoming.map((r) => ({
        id: r.id,
        ...contextFor(r.submission_id),
        subtitle:
          r.status === "unassigned"
            ? "Awaiting an eligible staff reviewer"
            : "Staff review in progress",
        tag: r.due_by ? `Due ${r.due_by.slice(0, 10)}` : "Awaiting assignment",
        type: "staff-review",
      })),
      recentFeedback: completed.map((r) => ({
        id: r.id,
        ...contextFor(r.submission_id),
        subtitle:
          r.status === "completed"
            ? "Staff review passed — view feedback"
            : "Revision requested — view next steps",
        daysAgo: `${Math.max(0, Math.floor((Date.now() - Date.parse(r.completed_at ?? r.required_at)) / 86400000))}d`,
        type: "staff-review",
      })),
    });
  } catch (error) {
    if (error instanceof AuthError)
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    apiLogger.error("Unable to load learner review feedback", error, { requestId });
    return jsonError("Feedback is temporarily unavailable", 503, {
      code: "FEEDBACK_UNAVAILABLE",
      requestId,
    });
  }
}
