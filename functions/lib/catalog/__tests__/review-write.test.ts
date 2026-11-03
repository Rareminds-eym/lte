import { describe, expect, it } from "vitest";
import { calculateHash } from "../ingestion/snapshot-serializer";
import { createHandlers } from "../review";
import { actor, id, MemoryDb, request } from "./fixtures";

const course = {
  levelCode: "CAP_L1",
  levelNo: 1,
  levelName: "Course",
  courseMetadata: {
    courseTitle: "Edited",
    courseCode: "CAP_L1",
    capabilityCode: "CAP",
    capabilityLevel: "L1",
    domain: "General",
    instructorLead: "Lead",
    courseSummary: "Summary",
    problemStatement: "Problem",
    capstoneTitle: "Capstone",
  },
  modules: [],
};
function fixture(status = "VALIDATED") {
  const snapshot = {
    tables: {
      levels: {
        columns: ["id", "level_code", "title", "description", "problem_statement"],
        rows: [[id, "CAP_L1", "Old", "Old", "Old"]],
      },
    },
    metadata: {},
    modules: [],
    levelCourses: [course, { ...course, levelCode: "CAP_L2", levelNo: 2 }],
    courseMetadata: course.courseMetadata,
  };
  return new MemoryDb({
    catalog_versions: [
      {
        id,
        entity_type: "catalog",
        status,
        created_by: actor.id,
        snapshot_hash: calculateHash({ tables: snapshot.tables, metadata: {} }),
        draft_revision: 5,
        snapshot_data: snapshot,
      },
    ],
  });
}
describe("review snapshot updates", () => {
  it("updates normalized tables and returns the new revision and hash", async () => {
    const db = fixture();
    const result = await createHandlers(db.dependencies()).PATCH(
      request("PATCH", { uploadId: id, course, expectedDraftRevision: 5 }),
    );
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.snapshot.draftRevision).toBe(6);
    expect(db.tables.catalog_versions[0].snapshot_data.tables.levels.rows[0][2]).toBe("Edited");
    expect(body.levelCourses).toHaveLength(2);
    expect(body.levelCourses[1].levelCode).toBe("CAP_L2");
    expect(body.reviewedSnapshotHash).toBe(db.tables.catalog_versions[0].snapshot_hash);
  });
  it("does not overwrite a concurrent review save", async () => {
    const db = fixture();
    const handler = createHandlers(db.dependencies()).PATCH;
    const results = await Promise.all(
      ["first", "second"].map((courseTitle) =>
        handler(
          request("PATCH", {
            uploadId: id,
            expectedDraftRevision: 5,
            course: { ...course, courseMetadata: { ...course.courseMetadata, courseTitle } },
          }),
        ),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(db.tables.catalog_versions[0].draft_revision).toBe(6);
  });
  it.each([
    "PUBLISHED",
    "ABANDONED",
  ])("does not turn %s back into an editable snapshot", async (status) => {
    const db = fixture(status);
    expect(
      (
        await createHandlers(db.dependencies()).PATCH(
          request("PATCH", { uploadId: id, course, expectedDraftRevision: 5 }),
        )
      ).status,
    ).toBe(409);
    expect(db.calls.filter((call) => call.operation === "update")).toHaveLength(0);
  });
  it.each([
    "VALIDATING",
    "PUBLISHING",
    "PUBLISHED",
  ])("does not edit a snapshot whose asset state is %s", async (status) => {
    const db = fixture();
    db.tables.catalog_versions[0].snapshot_data.assetValidation = { status };
    expect(
      (
        await createHandlers(db.dependencies()).PATCH(
          request("PATCH", { uploadId: id, course, expectedDraftRevision: 5 }),
        )
      ).status,
    ).toBe(409);
  });
  it("requires a revision, reports missing records and database failures", async () => {
    const db = fixture();
    const handler = createHandlers(db.dependencies()).PATCH;
    expect((await handler(request("PATCH", { uploadId: id, course }))).status).toBe(400);
    expect(
      (await handler(request("PATCH", { uploadId: "missing", course, expectedDraftRevision: 5 })))
        .status,
    ).toBe(404);
    db.failures.set("catalog_versions:update", "Unavailable");
    expect(
      (await handler(request("PATCH", { uploadId: id, course, expectedDraftRevision: 5 }))).status,
    ).toBe(500);
  });
});
