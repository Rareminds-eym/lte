import { describe, expect, it } from "vitest";
import { createHandlers } from "../drafts";
import { catalogFixture, id, MemoryDb, request } from "./fixtures";

describe("draft lifecycle and revision guard", () => {
  it.each([
    "VALIDATING",
    "PUBLISHING",
  ])("cannot edit or discard a queued catalog job in %s", async (status) => {
    const snapshot = { assetValidation: { status, assets: {} } };
    const db = new MemoryDb({
      catalog_versions: [
        { id, entity_type: "catalog", status: "DRAFT", draft_revision: 2, snapshot_data: snapshot },
      ],
    });
    const handlers = createHandlers(db.dependencies());
    expect(
      (
        await handlers.PUT(
          request("PUT", {
            draftId: id,
            expectedDraftRevision: 2,
            snapshotData: { course: { title: "Replacement" } },
          }),
        )
      ).status,
    ).toBe(409);
    expect((await handlers.DELETE(request("DELETE", undefined, `?draftId=${id}`))).status).toBe(
      409,
    );
    expect(db.tables.catalog_versions[0]).toMatchObject({
      status: "DRAFT",
      draft_revision: 2,
      snapshot_data: snapshot,
    });
  });
  it.each([
    null,
    "text",
    [],
    { assetValidation: {} },
    { workspacePublishLock: "forged" },
    { workspacePublishStartedAt: "forged" },
  ])("rejects malformed or client-owned publication state: %j", async (snapshotData) => {
    const db = new MemoryDb({
      catalog_versions: [
        { id, entity_type: "level", status: "DRAFT", draft_revision: 1, snapshot_data: {} },
      ],
    });
    expect(
      (
        await createHandlers(db.dependencies()).PUT(
          request("PUT", { draftId: id, expectedDraftRevision: 1, snapshotData }),
        )
      ).status,
    ).toBe(400);
    expect(db.calls).toHaveLength(0);
  });
  it("creates a draft, reuses it, saves a revision, and discards it", async () => {
    const db = catalogFixture();
    const handlers = createHandlers(db.dependencies());
    const opened = await handlers.POST(request("POST", { courseId: id }));
    expect(opened.status).toBe(200);
    const draft = (await opened.json()).draft;
    expect(draft.version_no).toBe(2);
    const reused = await handlers.POST(request("POST", { courseId: id }));
    expect((await reused.json()).draft.id).toBe(draft.id);
    const saved = await handlers.PUT(
      request("PUT", {
        draftId: draft.id,
        expectedDraftRevision: 1,
        snapshotData: { course: { title: "Edited" } },
      }),
    );
    expect(saved.status).toBe(200);
    expect((await saved.json()).newDraftRevision).toBe(2);
    expect(
      (
        await handlers.PUT(
          request("PUT", { draftId: draft.id, expectedDraftRevision: 1, snapshotData: {} }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await handlers.DELETE(request("DELETE", undefined, `?draftId=${draft.id}`))).status,
    ).toBe(200);
    expect(db.tables.catalog_versions.find((row) => row.id === draft.id).status).toBe("ABANDONED");
  });
  it("allows one winner when two writers use the same revision", async () => {
    const db = new MemoryDb({
      catalog_versions: [
        { id, entity_type: "level", status: "DRAFT", draft_revision: 5, snapshot_data: {} },
      ],
    });
    const handler = createHandlers(db.dependencies()).PUT;
    const results = await Promise.all(
      ["first", "second"].map((title) =>
        handler(request("PUT", { draftId: id, expectedDraftRevision: 5, snapshotData: { title } })),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(db.tables.catalog_versions[0].draft_revision).toBe(6);
  });
  it("blocks saves and discards during publication", async () => {
    const db = new MemoryDb({
      catalog_versions: [
        {
          id,
          entity_type: "level",
          status: "DRAFT",
          draft_revision: 1,
          snapshot_data: { workspacePublishLock: "lock" },
        },
      ],
    });
    const handler = createHandlers(db.dependencies());
    expect(
      (
        await handler.PUT(
          request("PUT", { draftId: id, expectedDraftRevision: 1, snapshotData: {} }),
        )
      ).status,
    ).toBe(409);
    expect((await handler.DELETE(request("DELETE", undefined, `?draftId=${id}`))).status).toBe(409);
    expect(db.tables.catalog_versions[0].status).toBe("DRAFT");
  });
  it("validates payloads, missing records and failures", async () => {
    const db = new MemoryDb();
    const handlers = createHandlers(db.dependencies());
    expect((await handlers.POST(request("POST", {}))).status).toBe(400);
    expect((await handlers.POST(request("POST", { courseId: id }))).status).toBe(404);
    expect(
      (await handlers.PUT(request("PUT", { draftId: id, expectedDraftRevision: "1" }))).status,
    ).toBe(400);
    expect((await handlers.DELETE(request("DELETE"))).status).toBe(400);
    db.failures.set("catalog_versions:update", "Unavailable");
    expect((await handlers.DELETE(request("DELETE", undefined, `?draftId=${id}`))).status).toBe(
      500,
    );
  });
  it.each([
    "POST",
    "PUT",
    "DELETE",
  ] as const)("does not access the database on unauthorized %s", async (method) => {
    const db = new MemoryDb();
    const deps = db.dependencies();
    deps.authenticate = async () => ({ user: null, error: null });
    expect(
      (await createHandlers(deps)[method](request(method, method === "DELETE" ? undefined : {})))
        .status,
    ).toBe(401);
    expect(db.calls).toHaveLength(0);
  });
});
