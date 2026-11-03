import { describe, expect, it, vi } from "vitest";
import type { CatalogDependencies } from "../dependencies";
import { catalogRequest } from "../http";
import { calculateHash } from "../ingestion/snapshot-serializer";
import { createHandlers } from "../upload";

function setup() {
  const insert = vi.fn(() => ({
    select: () => ({
      single: async () => ({ data: { id: "persisted-id", status: "VALIDATED" }, error: null }),
    }),
  }));
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: { version_no: 4 }, error: null }) }),
        }),
      }),
    }),
    insert,
  }));
  const dependencies = {
    db: { from },
    user: { userId: "verified-actor" },
  } as unknown as CatalogDependencies;
  return { insert, from, POST: createHandlers(dependencies).POST };
}
function payload() {
  const normalized = {
    tables: { levels: { columns: ["id", "level_code"], rows: [["level", "LTE_CAP_L1"]] } },
    metadata: {
      sourceType: "xlsx",
      sourceName: "catalog.xlsx",
      tableCount: 1,
      totalRows: 1,
      parsedAt: "2026-10-14T00:00:00.000Z",
    },
  };
  return {
    fileName: "catalog.xlsx",
    sourceFileHash: "a".repeat(64),
    snapshot: {
      ...normalized,
      uploadId: "temporary-id",
      sourceType: "xlsx",
      sourceName: "catalog.xlsx",
      snapshotHash: calculateHash(normalized),
      courseMetadata: {},
      modules: [],
      levelCourses: [],
      validationReport: { verified: true, totalRowsParsed: 1 },
      createdAt: "2026-10-14T00:00:00.000Z",
      status: "validated",
    },
  };
}
function request(body: unknown) {
  return catalogRequest(
    new Request("https://lte.example.com/api/v1/admin/catalog/upload", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
describe("normalized upload persistence boundary", () => {
  it("stores the unchanged snapshot with the verified actor and existing version model", async () => {
    const { POST, insert } = setup();
    const body = payload();
    const result = await POST(request(body));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      uploadId: "persisted-id",
      snapshot: { reviewedSnapshotHash: body.snapshot.snapshotHash },
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "catalog",
        version_no: 5,
        created_by: "verified-actor",
        snapshot_hash: body.snapshot.snapshotHash,
      }),
    );
  });
  it("rejects forged publish/queue state, arbitrary tables and changed hashes before database access", async () => {
    const { POST, from } = setup();
    const body = payload();
    const forged = {
      ...body,
      snapshot: { ...body.snapshot, assetValidation: { status: "PUBLISHING", assets: {} } },
    };
    const hash = { ...body, snapshot: { ...body.snapshot, snapshotHash: "b".repeat(64) } };
    const table = {
      ...body,
      snapshot: { ...body.snapshot, tables: { users: { columns: ["id"], rows: [["victim"]] } } },
    };
    for (const input of [forged, hash, table])
      expect((await POST(request(input))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
