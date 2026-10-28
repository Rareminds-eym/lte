import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LteEnv, PagesContext } from "../../../shared/types";
import { calculateHash } from "../ingestion/snapshot-serializer";
import { actor, catalogFixture, id } from "./fixtures";

const state = vi.hoisted(() => ({ db: null as unknown, roles: ["super_admin"] }));
vi.mock("../../supabase", () => ({ createServiceSupabase: () => state.db }));
// Authorization itself is exercised with real signed JWTs in auth.test.ts.
vi.mock("@rareminds-eym/auth-core", () => ({
  createAuth: () => ({
    authenticate: (handler: unknown) => handler,
    requireActiveMembership: (handler: unknown) => handler,
    requireRole:
      (_roles: unknown, handler: (request: Request, verified: unknown) => Promise<Response>) =>
      (request: Request) =>
        handler(request, { user: { sub: actor.id, roles: state.roles } }),
  }),
}));
const secret = "test-machine-secret-at-least-thirty-two-characters";
function context(path: string, method = "GET", body?: unknown): PagesContext {
  return {
    request: new Request(`https://lte.example.com${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env: {
      SSO_SERVICE: {},
      LTE_INTERNAL_SECRET: secret,
      STORAGE_BUCKET: { get: async () => null },
    } as unknown as LteEnv,
    params: { jobId: id },
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(),
  };
}
async function signed(path: string, body: unknown) {
  const ctx = context(path, "POST", body);
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`POST\n${path}\n${timestamp}\n${JSON.stringify(body)}`),
    ),
  );
  ctx.request.headers.set("x-lte-timestamp", timestamp);
  ctx.request.headers.set(
    "x-lte-signature",
    [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
  return ctx;
}
beforeEach(() => {
  state.db = catalogFixture();
});
describe("native Pages catalog endpoints", () => {
  it("acknowledges a persisted discarded asset job without processing it", async () => {
    const db = catalogFixture();
    db.tables.catalog_versions[0] = {
      id,
      entity_type: "catalog",
      status: "ABANDONED",
      snapshot_data: {
        assetValidation: {
          assets: { "https://drive.google.com/file/d/test/view": { status: "PENDING" } },
        },
      },
    };
    state.db = db;
    const endpoint = await import("../../../api/v1/internal/catalog/process-asset");
    const response = await endpoint.onRequestPost(
      await signed("/api/v1/internal/catalog/process-asset", {
        uploadId: id,
        assetUrl: "https://drive.google.com/file/d/test/view",
        attempts: 1,
      }),
    );
    expect(await response.json()).toEqual({ success: true, skipped: true });
    expect(db.calls.filter((call) => call.operation !== "read")).toHaveLength(0);
  });
  it("dispatches workspace, template, review, content and status reads", async () => {
    const workspace = await import("../../../api/v1/admin/catalog/workspace");
    expect((await workspace.onRequestGet(context("/workspace"))).status).toBe(200);
    const template = await import("../../../api/v1/admin/catalog/template-data");
    expect(
      (await template.onRequestGet(context("/template-data?capabilityCode=CAP&levelNo=2"))).status,
    ).toBe(200);
    const content = await import("../../../api/v1/admin/catalog/course-content");
    expect((await content.onRequestGet(context(`/course-content?courseId=${id}`))).status).toBe(
      200,
    );
    const review = await import("../../../api/v1/admin/catalog/review");
    expect((await review.onRequestGet(context("/review"))).status).toBe(404);
    const status = await import("../../../api/v1/admin/catalog/publish/[jobId]/status");
    expect((await status.onRequestGet(context("/status"))).status).toBe(200);
  });
  it("runs upload, review save and asset-free publishing through the real handlers", async () => {
    const snapshot = {
      uploadId: "parsed-upload",
      sourceType: "xlsx",
      sourceName: "course.xlsx",
      tables: {},
      metadata: {},
      snapshotHash: calculateHash({ tables: {}, metadata: {} }),
      courseMetadata: {},
      modules: [],
      validationReport: {},
      status: "validated",
      createdAt: new Date().toISOString(),
    };
    const upload = await import("../../../api/v1/admin/catalog/upload");
    const result = await upload.onRequestPost(
      context("/upload", "POST", {
        fileName: "course.xlsx",
        sourceFileHash: "a".repeat(64),
        snapshot,
      }),
    );
    expect(result.status).toBe(200);
    const uploaded = await result.json();
    expect(uploaded.snapshot.draftRevision).toBe(1);
    const review = await import("../../../api/v1/admin/catalog/review");
    expect(
      (await review.onRequestGet(context(`/review?uploadId=${uploaded.uploadId}`))).status,
    ).toBe(200);
    const saved = await review.onRequestPatch(
      context("/review", "PATCH", {
        uploadId: uploaded.uploadId,
        expectedDraftRevision: 1,
        course: {
          levelCode: "CAP_L1",
          levelNo: 1,
          courseMetadata: { courseTitle: "Reviewed" },
          modules: [],
        },
      }),
    );
    expect(saved.status).toBe(200);
    const savedBody = await saved.json();
    const publish = await import("../../../api/v1/admin/catalog/publish");
    const published = await publish.onRequestPost(
      context("/publish", "POST", {
        uploadId: uploaded.uploadId,
        reviewedSnapshotHash: savedBody.reviewedSnapshotHash,
      }),
    );
    expect(published.status).toBe(200);
    expect((await published.json()).status).toBe("published");
    const retried = await publish.onRequestPost(
      context("/publish", "POST", {
        uploadId: uploaded.uploadId,
        reviewedSnapshotHash: savedBody.reviewedSnapshotHash,
      }),
    );
    expect(retried.status).toBe(200);
  });
  it("dispatches draft, editor and lifecycle mutations", async () => {
    const drafts = await import("../../../api/v1/admin/catalog/drafts");
    const opened = await drafts.onRequestPost(context("/drafts", "POST", { courseId: id }));
    const draft = (await opened.json()).draft;
    expect(
      (
        await drafts.onRequestPut(
          context("/drafts", "PUT", {
            draftId: draft.id,
            expectedDraftRevision: 1,
            snapshotData: { kind: "workspace_edit_draft", course: { course_name: "Edited" } },
          }),
        )
      ).status,
    ).toBe(200);
    const content = await import("../../../api/v1/admin/catalog/course-content");
    expect(
      (
        await content.onRequestPut(
          context("/course-content", "PUT", {
            courseId: id,
            expectedDraftRevision: 2,
            updates: { course: { course_name: "Edited" } },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await content.onRequestPost(
          context("/course-content", "POST", { courseId: id, expectedDraftRevision: 3 }),
        )
      ).status,
    ).toBe(200);
    const second = await drafts.onRequestPost(context("/drafts", "POST", { courseId: id }));
    const newId = (await second.json()).draft.id;
    expect(
      (await content.onRequestDelete(context(`/course-content?draftId=${newId}`, "DELETE"))).status,
    ).toBe(200);
    const third = await drafts.onRequestPost(context("/drafts", "POST", { courseId: id }));
    expect(
      (
        await drafts.onRequestDelete(
          context(`/drafts?draftId=${(await third.json()).draft.id}`, "DELETE"),
        )
      ).status,
    ).toBe(200);
    const lifecycle = await import("../../../api/v1/admin/catalog/lifecycle");
    expect(
      (
        await lifecycle.onRequestPost(
          context("/lifecycle", "POST", { action: "RETIRE_COURSE", courseId: id }),
        )
      ).status,
    ).toBe(200);
  });
  it("serves both asset URL routes using the existing bucket", async () => {
    for (const module of [
      await import("../../../api/v1/catalog/assets"),
      await import("../../../api/admin/lte/assets"),
    ]) {
      const ctx = context("/assets?key=resources%2Ffile.pdf");
      ctx.env.STORAGE_BUCKET = {
        get: async () => ({
          body: new Response("file").body,
          httpMetadata: { contentType: "application/pdf" },
        }),
      } as unknown as LteEnv["STORAGE_BUCKET"];
      const result = await module.onRequestGet(ctx);
      expect(result.status).toBe(200);
      expect(await result.text()).toBe("file");
      expect((await module.onRequestGet(context("/assets?key=../invalid"))).status).toBe(400);
    }
  });
  it("verifies signed export and diagnostics and rejects an unrelated asset job", async () => {
    const exported = await import("../../../api/v1/internal/catalog/export");
    const result = await exported.onRequestPost(
      await signed("/api/v1/internal/catalog/export", { roleIds: [id] }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).tables.roles).toHaveLength(1);
    const health = await import("../../../api/v1/internal/catalog/health");
    expect(
      (await health.onRequestPost(await signed("/api/v1/internal/catalog/health", {}))).status,
    ).toBe(200);
    expect(
      (await health.onRequestPost(await signed("/api/v1/internal/catalog/health", { extra: true })))
        .status,
    ).toBe(400);
    const asset = await import("../../../api/v1/internal/catalog/process-asset");
    expect(
      (
        await asset.onRequestPost(
          await signed("/api/v1/internal/catalog/process-asset", {
            uploadId: id,
            assetUrl: "https://example.com/unknown.pdf",
            attempts: 1,
          }),
        )
      ).status,
    ).toBe(400);
  });
});
