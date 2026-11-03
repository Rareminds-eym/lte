import {
  recalculateLevelProgress,
  recalculateSubmissionLevelProgress,
} from "@functions/api/v1/courses/progressQueries";
import { calculateReadiness, completeCourseOnTime } from "@functions/lib/xp-engine.progress";
import { beforeEach, expect, it, vi } from "vitest";
import { issueCourseCertificate, issueRoleCertificate } from "../issuance";
import { gateway, levelId, pathId, row, userId } from "./fixtures";

vi.mock("../issuance", () => ({ issueCourseCertificate: vi.fn(), issueRoleCertificate: vi.fn() }));
vi.mock("@functions/lib/xp-engine.core", () => ({
  awardXp: vi.fn().mockResolvedValue({ xpAwarded: 10 }),
}));
vi.mock("@functions/lib/xp-engine.engagement", () => ({ evaluateMilestones: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("resolves an accepted submission through learner-owned progress before issuing", async () => {
  const { qb, read } = gateway();
  read.mockImplementation(async (policy, options) => {
    const filter = options?.filters?.[0];
    if (policy.table === "artifact_submissions") return { user_module_progress_id: pathId };
    if (policy.table === "user_module_progress" && filter?.column === "id")
      return { user_capability_level_progress_id: row.level_progress_id };
    if (policy.table === "user_capability_level_progress" && filter?.column === "id")
      return { level_id: levelId };
    if (policy.table === "modules") return [{ id: "module" }];
    if (policy.table === "user_module_progress")
      return [{ id: pathId, module_status: "mastered", completion_percentage: 100 }];
    if (policy.table === "user_capability_level_progress")
      return { id: row.level_progress_id, status: "in_progress" };
    if (policy.table === "levels") return { duration_minutes: 1 };
    if (policy.table === "user_stage_progress") return [];
    if (policy.table === "learning_paths") return [];
    return null;
  });
  await recalculateSubmissionLevelProgress(qb, userId, row.id);
  expect(read).toHaveBeenCalledWith(
    expect.objectContaining({
      table: "artifact_submissions",
      ownership: { column: "user_id", source: "authenticatedUserId", required: true },
    }),
    expect.objectContaining({ auth: { userId } }),
  );
  expect(issueCourseCertificate).toHaveBeenCalledWith(
    qb,
    {},
    { userId, levelId, levelProgressId: row.level_progress_id },
  );
});
it.each([
  60, 100_000,
])("issues course certificates for completion taking %s seconds", async (seconds) => {
  const { qb, read } = gateway();
  read.mockImplementation(async (policy, options) => {
    if (policy.table === "modules") return [{ id: "module" }];
    if (policy.table === "user_module_progress")
      return [{ id: "module-progress", module_status: "completed", completion_percentage: 100 }];
    if (policy.table === "user_capability_level_progress")
      return { id: row.level_progress_id, status: "in_progress" };
    if (policy.table === "levels") return { duration_minutes: 1 };
    if (policy.table === "user_stage_progress") return [{ time_spent_seconds: seconds }];
    if (policy.table === "learning_paths" && options?.filters?.[0]?.column === "is_latest")
      return [];
    return null;
  });
  await recalculateLevelProgress(qb, userId, levelId);
  expect(issueCourseCertificate).toHaveBeenCalledWith(
    qb,
    {},
    { userId, levelId, levelProgressId: row.level_progress_id },
  );
});
it("keeps progress successful when issuance fails", async () => {
  const { qb, read, update } = gateway();
  read.mockImplementation(
    async (policy) =>
      ({
        modules: [{ id: "module" }],
        user_module_progress: [
          { id: "progress", module_status: "completed", completion_percentage: 100 },
        ],
        user_capability_level_progress: { id: row.level_progress_id, status: "in_progress" },
        levels: { duration_minutes: 1 },
        user_stage_progress: [],
        learning_paths: [],
      })[policy.table as string],
  );
  vi.mocked(issueCourseCertificate).mockRejectedValueOnce(new Error("database offline"));
  await expect(recalculateLevelProgress(qb, userId, levelId)).resolves.toBeUndefined();
  expect(update).toHaveBeenCalled();
});
it("issues a role only on the completed transition and isolates failure", async () => {
  const { qb, read } = gateway();
  let status = "in_progress";
  read.mockImplementation(async (policy, options) => {
    if (policy.table === "user_capability_level_progress")
      return [
        {
          id: row.level_progress_id,
          level_id: levelId,
          status: "completed",
          completion_percentage: 100,
        },
      ];
    if (policy.table === "learning_paths")
      return {
        role_id: levelId,
        role_readiness_percentage: 0,
        status,
        started_at: row.created_at,
        completed_at: null,
      };
    if (policy.table === "users") return null;
    if (options?.result === "maybeSingle") return null;
    return [];
  });
  vi.mocked(issueRoleCertificate).mockRejectedValueOnce(new Error("issue unavailable"));
  await expect(calculateReadiness(qb, userId, pathId)).resolves.toHaveProperty("readinessScore");
  expect(issueRoleCertificate).toHaveBeenCalledOnce();
  expect(read).toHaveBeenCalledWith(
    expect.objectContaining({
      table: "users",
      select: "bio:metadata->>bio,job_title:metadata->>job_title,skills:metadata->skills",
      ownership: { column: "id", source: "authenticatedUserId", required: true },
    }),
    expect.objectContaining({ auth: { userId } }),
  );
  status = "completed";
  await calculateReadiness(qb, userId, pathId);
  expect(issueRoleCertificate).toHaveBeenCalledOnce();
  expect(completeCourseOnTime).toBeTypeOf("function");
});
