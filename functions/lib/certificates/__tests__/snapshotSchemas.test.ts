import { expect, it } from "vitest";
import { completedLevelSchema, completedPathSchema, levelSchema } from "../snapshotSchemas";

it("rejects malformed database rows instead of relying on TypeScript casts", () => {
  for (const schema of [completedLevelSchema, completedPathSchema, levelSchema])
    expect(() => schema.parse({})).toThrow();
  expect(() =>
    levelSchema.parse({
      title: "Course",
      level_code: "L1",
      duration_minutes: -1,
      capabilities: { code: "PRO", name: "Course" },
      level_scale: { level_no: 1 },
    }),
  ).toThrow();
});
