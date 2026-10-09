import { expect, it } from "vitest";
import { courseSnapshot, rolePath, roleSnapshot } from "../snapshots";
import { gateway, levelId, pathId, row, userId } from "./fixtures";

const progress = {
  id: row.level_progress_id,
  level_id: levelId,
  learning_path_id: pathId,
  status: "completed",
  completed_at: row.completion_date,
  badge: "skilled",
};
const level = {
  title: "Course",
  level_code: "L1",
  duration_minutes: 60,
  capabilities: { code: "PRO", name: "Problem solving" },
  level_scale: { level_no: 1 },
};
it("snapshots completion only from authenticated, completed progress and validates upstream fields", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValueOnce(progress).mockResolvedValueOnce(level).mockResolvedValueOnce([]);
  expect(
    await courseSnapshot(qb, { userId, levelId, levelProgressId: row.level_progress_id! }),
  ).toMatchObject({ title: "Course", level_label: "Level 1", badge: "skilled" });
  expect(read.mock.calls[0]?.[1].auth).toEqual({ userId });
  read.mockResolvedValueOnce({ ...progress, status: "in_progress" });
  await expect(
    courseSnapshot(qb, { userId, levelId, levelProgressId: row.level_progress_id! }),
  ).rejects.toThrow("not completed");
  read.mockResolvedValueOnce({ malformed: true });
  await expect(
    courseSnapshot(qb, { userId, levelId, levelProgressId: row.level_progress_id! }),
  ).rejects.toThrow("Invalid certificate service result");
});
it("requires completed roles and snapshots role/track fields without trusting malformed data", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValueOnce(null);
  await expect(rolePath(qb, userId, pathId)).rejects.toThrow("not completed");
  const path = {
    id: pathId,
    role_id: levelId,
    learning_track_id: pathId,
    status: "completed",
    completed_at: row.completion_date,
    badge: "skilled",
    role_readiness_percentage: 80,
  };
  read
    .mockResolvedValueOnce({ role_name: "Engineer" })
    .mockResolvedValueOnce({ track: "Engineering" })
    .mockResolvedValueOnce([progress])
    .mockResolvedValueOnce(level);
  expect(await roleSnapshot(qb, userId, path)).toMatchObject({
    title: "Engineer",
    subtitle: "Engineering",
    metadata: { readinessScore: 80 },
  });
});
