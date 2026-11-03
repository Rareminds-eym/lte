import { describe, expect, it } from "vitest";
import { createHandlers } from "../lifecycle";
import { catalogFixture, id, request } from "./fixtures";

describe("existing course lifecycle operations", () => {
  it("retires, reactivates and publishes a course level", async () => {
    const db = catalogFixture();
    const handler = createHandlers(db.dependencies()).POST;
    for (const [action, active] of [
      ["RETIRE_COURSE", false],
      ["REACTIVATE_COURSE", true],
    ] as const) {
      expect((await handler(request("POST", { action, courseId: id }))).status).toBe(200);
      expect(db.tables.levels[0].is_active).toBe(active);
    }
    expect(
      (await handler(request("POST", { action: "PUBLISH_COURSE_LEVEL", courseId: id }))).status,
    ).toBe(200);
    expect(db.tables.levels[0].status).toBe("published");
  });
  it("restores an editor snapshot as a new version", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions[0].snapshot_data = {
      kind: "workspace_edit",
      course: { course_name: "Restored" },
      modules: [
        {
          id,
          title: "Restored module",
          content: [{ id, stage_description: "Restored stage" }],
          artifacts: [
            {
              id,
              questions: [{ id, title: "Restored question" }],
              templates: [{ id, file_name: "restored.xlsx" }],
            },
          ],
        },
      ],
      eContent: [{ id, title: "Restored resource" }],
    };
    const result = await createHandlers(db.dependencies()).POST(
      request("POST", {
        action: "ROLLBACK_COURSE_VERSION",
        courseId: id,
        rollbackSourceVersionId: id,
      }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).newVersionNo).toBe(2);
    expect(db.tables.levels[0].title).toBe("Restored");
    expect(db.tables.modules[0].title).toBe("Restored module");
    expect(db.tables.artifact_questions[0].title).toBe("Restored question");
    expect(db.tables.catalog_versions[1].rollback_source_version_id).toBe(id);
  });
  it("requires explicit revision-matched discard before restoring over a draft", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions.push({
      id: "draft",
      entity_type: "level",
      entity_id: id,
      status: "DRAFT",
      draft_revision: 2,
      snapshot_data: {},
    });
    const handler = createHandlers(db.dependencies()).POST;
    const body = { action: "ROLLBACK_COURSE_VERSION", courseId: id, rollbackSourceVersionId: id };
    expect((await handler(request("POST", body))).status).toBe(409);
    expect(
      (
        await handler(
          request("POST", { ...body, confirmDiscardDraft: true, expectedDraftRevision: 1 }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await handler(
          request("POST", { ...body, confirmDiscardDraft: true, expectedDraftRevision: 2 }),
        )
      ).status,
    ).toBe(200);
    expect(db.tables.catalog_versions[1].status).toBe("ABANDONED");
  });
  it("cannot discard a draft claimed concurrently for publication", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions.push({
      id: "draft",
      entity_type: "level",
      entity_id: id,
      status: "DRAFT",
      draft_revision: 2,
      snapshot_data: { workspacePublishLock: "active" },
    });
    expect(
      (
        await createHandlers(db.dependencies()).POST(
          request("POST", {
            action: "ROLLBACK_COURSE_VERSION",
            courseId: id,
            rollbackSourceVersionId: id,
            confirmDiscardDraft: true,
            expectedDraftRevision: 2,
          }),
        )
      ).status,
    ).toBe(409);
    expect(db.tables.levels[0].title).toBe("Course");
  });
  it("rejects malformed actions and reports restore failures", async () => {
    const db = catalogFixture();
    const handler = createHandlers(db.dependencies()).POST;
    expect((await handler(request("POST", { action: "unknown" }))).status).toBe(400);
    expect(
      (await handler(request("POST", { action: "RENAME_CANONICAL_CODE_WITH_ALIAS" }))).status,
    ).toBe(410);
    for (const action of [
      "RETIRE_COURSE",
      "REACTIVATE_COURSE",
      "PUBLISH_COURSE_LEVEL",
      "ROLLBACK_COURSE_VERSION",
    ])
      expect((await handler(request("POST", { action }))).status).toBe(400);
    db.failures.set("levels:update", "Write failed");
    expect(
      (
        await handler(
          request("POST", {
            action: "ROLLBACK_COURSE_VERSION",
            courseId: id,
            rollbackSourceVersionId: id,
          }),
        )
      ).status,
    ).toBe(500);
    db.tables.catalog_versions[0].snapshot_data = { unsupported: true };
    expect(
      (
        await handler(
          request("POST", {
            action: "ROLLBACK_COURSE_VERSION",
            courseId: id,
            rollbackSourceVersionId: id,
          }),
        )
      ).status,
    ).toBe(400);
  });
});
