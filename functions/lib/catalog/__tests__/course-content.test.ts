import { describe, expect, it, vi } from "vitest";
import { createHandlers } from "../course-content";
import type { CatalogDependencies } from "../dependencies";
import { catalogFixture, id, request } from "./fixtures";

const updates = {
  course: {
    course_name: "Edited course",
    description: "Edited",
    level_code: "ILLEGAL",
    capability_id: "ILLEGAL",
  },
  modules: [
    {
      id,
      title: "Edited module",
      content: [{ id, stage_description: "Edited stage" }],
      artifacts: [
        {
          id,
          total_score: 12,
          passing_score: 6,
          questions: [{ id, title: "Edited question" }],
          templates: [
            { id, file_url: "/api/admin/lte/assets?key=resources/file.pdf", file_name: "file.pdf" },
          ],
        },
      ],
    },
  ],
  eContent: [{ id, title: "Edited resource", url: "/api/admin/lte/assets?key=resources/file.pdf" }],
};
describe("course editor draft and publication", () => {
  it("cannot discard a queued catalog job through the course editor endpoint", async () => {
    const db = catalogFixture();
    const snapshot = { assetValidation: { status: "VALIDATING", assets: {} } };
    db.tables.catalog_versions[0] = {
      id,
      entity_type: "catalog",
      status: "DRAFT",
      snapshot_data: snapshot,
    };
    expect(
      (
        await createHandlers(db.dependencies()).DELETE(
          request("DELETE", undefined, `?draftId=${id}`),
        )
      ).status,
    ).toBe(409);
    expect(db.tables.catalog_versions[0]).toMatchObject({
      status: "DRAFT",
      snapshot_data: snapshot,
    });
  });
  it("rejects multiple URLs in editor scalar fields before creating a draft", async () => {
    const db = catalogFixture();
    const result = await createHandlers(db.dependencies()).PUT(
      request("PUT", {
        courseId: id,
        updates: {
          eContent: [
            {
              id,
              url: "https://drive.google.com/file/d/a/view | https://drive.google.com/file/d/b/view",
            },
          ],
        },
      }),
    );
    expect(result.status).toBe(400);
    expect(db.calls.filter((call) => call.operation !== "read")).toHaveLength(0);
  });
  it("stages edited Drive templates and learning media before applying their final URLs", async () => {
    const db = catalogFixture();
    const deps = db.dependencies();
    const stageStream = vi.fn(async () => ({
      publicUrl: "/api/admin/lte/assets?key=resources%2Fstored.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    deps.publishOptions.storage = {
      stageStream,
    } as unknown as CatalogDependencies["publishOptions"]["storage"];
    const handlers = createHandlers(deps);
    const edited = structuredClone(updates);
    edited.modules[0]!.artifacts[0]!.templates[0]!.file_url =
      "https://drive.google.com/file/d/doc/view";
    edited.eContent[0]!.url = "https://docs.google.com/document/d/doc/edit";
    expect((await handlers.PUT(request("PUT", { courseId: id, updates: edited }))).status).toBe(
      200,
    );
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 1 }))).status,
    ).toBe(200);
    expect(stageStream).toHaveBeenCalledTimes(2);
    expect(db.tables.artifact_templates[0].file_url).toBe(
      "/api/admin/lte/assets?key=resources%2Fstored.docx",
    );
    expect(db.tables.e_content[0].url).toBe("/api/admin/lte/assets?key=resources%2Fstored.docx");
  });
  it("loads current content and its published version", async () => {
    const handler = createHandlers(catalogFixture().dependencies()).GET;
    expect((await handler(request())).status).toBe(400);
    expect((await handler(request("GET", undefined, "?courseId=missing"))).status).toBe(404);
    const response = await handler(request("GET", undefined, `?courseId=${id}`));
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
  it("saves edits to a draft, preserves identity, then publishes the exact revision", async () => {
    const db = catalogFixture();
    const handlers = createHandlers(db.dependencies());
    const saved = await handlers.PUT(request("PUT", { courseId: id, updates }));
    expect(saved.status).toBe(200);
    const body = await saved.json();
    expect(db.tables.levels[0].title).toBe("Course");
    const draft = db.tables.catalog_versions.find((row) => row.id === body.draftId);
    expect(draft.snapshot_data.course.level_code).toBeUndefined();
    const published = await handlers.POST(
      request("POST", { courseId: id, expectedDraftRevision: 1 }),
    );
    expect(published.status).toBe(200);
    expect(db.tables.levels[0]).toMatchObject({
      title: "Edited course",
      level_code: "CAP_L1",
      capability_id: id,
    });
    expect(db.tables.modules[0].title).toBe("Edited module");
    expect(db.tables.artifact_questions[0].title).toBe("Edited question");
    expect(db.tables.e_content[0].title).toBe("Edited resource");
    expect(draft.status).toBe("PUBLISHED");
  });
  it("rejects a stale editor and allows only one simultaneous save", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions.push({
      id: "draft",
      entity_type: "level",
      entity_id: id,
      status: "DRAFT",
      draft_revision: 5,
      snapshot_data: {},
    });
    const handler = createHandlers(db.dependencies()).PUT;
    const results = await Promise.all(
      ["first", "second"].map((title) =>
        handler(
          request("PUT", {
            courseId: id,
            expectedDraftRevision: 5,
            updates: { course: { course_name: title } },
          }),
        ),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(db.tables.catalog_versions[1].draft_revision).toBe(6);
    expect(
      (await handler(request("PUT", { courseId: id, expectedDraftRevision: 5, updates }))).status,
    ).toBe(409);
  });
  it("blocks editors, discard and a second publisher while live content is being written", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions.push({
      id: "draft",
      entity_type: "level",
      entity_id: id,
      status: "DRAFT",
      draft_revision: 1,
      snapshot_data: { course: { course_name: "Published" } },
    });
    const handlers = createHandlers(db.dependencies());
    let resume!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    db.beforeExecute = async (query) => {
      if (query.table === "levels" && query.operation === "update") {
        started();
        await paused;
      }
    };
    const publishing = handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 1 }));
    await entered;
    db.tables.catalog_versions[1].snapshot_data.workspacePublishStartedAt = new Date(
      Date.now() - 360001,
    ).toISOString();
    expect(
      (await handlers.PUT(request("PUT", { courseId: id, expectedDraftRevision: 2, updates })))
        .status,
    ).toBe(409);
    expect((await handlers.DELETE(request("DELETE", undefined, "?draftId=draft"))).status).toBe(
      409,
    );
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 2 }))).status,
    ).toBe(409);
    resume();
    expect((await publishing).status).toBe(200);
  });
  it("stops workspace writes if ownership changes while assets are being staged", async () => {
    const db = catalogFixture();
    const deps = db.dependencies();
    deps.publishOptions.storage = {
      stageStream: vi.fn(async () => {
        db.tables.catalog_versions.find(
          (row) => row.status === "DRAFT",
        ).snapshot_data.workspacePublishLock = "different-owner";
        return {
          publicUrl: "/api/admin/lte/assets?key=resources/stored.pdf",
          mimeType: "application/pdf",
        };
      }),
    } as unknown as CatalogDependencies["publishOptions"]["storage"];
    const handlers = createHandlers(deps);
    await handlers.PUT(
      request("PUT", {
        courseId: id,
        updates: {
          course: { course_name: "New" },
          eContent: [{ id, url: "https://drive.google.com/file/d/test/view" }],
        },
      }),
    );
    const result = await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 1 }));
    expect(result.status).toBe(500);
    expect(db.tables.levels[0].title).toBe("Course");
    expect(db.tables.catalog_versions[1].snapshot_data.workspacePublishLock).toBe(
      "different-owner",
    );
  });
  it("releases a failed publication and supports retry after reloading its revision", async () => {
    const db = catalogFixture();
    const handlers = createHandlers(db.dependencies());
    await handlers.PUT(request("PUT", { courseId: id, updates }));
    db.failures.set("levels:update", "Write failed");
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 1 }))).status,
    ).toBe(500);
    const draft = db.tables.catalog_versions.find((row) => row.status === "DRAFT");
    expect(draft.snapshot_data.workspacePublishLock).toBeUndefined();
    db.failures.clear();
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 2 }))).status,
    ).toBe(200);
  });
  it("does not replace an existing publication owner based on elapsed time", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions.push({
      id: "draft",
      entity_type: "level",
      entity_id: id,
      status: "DRAFT",
      draft_revision: 1,
      snapshot_data: {
        workspacePublishLock: "old",
        workspacePublishStartedAt: new Date(Date.now() - 360000).toISOString(),
        course: { course_name: "Recovered" },
      },
    });
    expect(
      (
        await createHandlers(db.dependencies()).POST(
          request("POST", { courseId: id, expectedDraftRevision: 1 }),
        )
      ).status,
    ).toBe(409);
  });
  it("discards an editable draft and rejects invalid or missing payloads", async () => {
    const db = catalogFixture();
    const handlers = createHandlers(db.dependencies());
    expect((await handlers.PUT(request("PUT", {}))).status).toBe(400);
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: "1" }))).status,
    ).toBe(400);
    expect(
      (await handlers.POST(request("POST", { courseId: id, expectedDraftRevision: 1 }))).status,
    ).toBe(404);
    expect((await handlers.DELETE(request("DELETE"))).status).toBe(400);
    const response = await handlers.PUT(request("PUT", { courseId: id, updates }));
    const body = await response.json();
    expect(
      (await handlers.DELETE(request("DELETE", undefined, `?draftId=${body.draftId}`))).status,
    ).toBe(200);
  });
});
