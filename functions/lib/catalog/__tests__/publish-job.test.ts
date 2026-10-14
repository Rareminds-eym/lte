import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogDependencies } from "../dependencies";
import { AssetValidationError, validateAndStreamAsset } from "../ingestion/asset-validator";
import {
  createPublishJob,
  finalizePublishJob,
  finalizePublishJobIfReady,
  markAssetValidationFailed,
  processAssetValidationMessage,
  readPublishJobStatus,
} from "../ingestion/publish-job";
import { publishSnapshotTables } from "../ingestion/publish-snapshot-tables";
import { calculateHash } from "../ingestion/snapshot-serializer";
import { actor, id, MemoryDb, sourceUrl } from "./fixtures";

vi.mock("../ingestion/publish-snapshot-tables", () => ({ publishSnapshotTables: vi.fn() }));
vi.mock("../ingestion/asset-validator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ingestion/asset-validator")>()),
  validateAndStreamAsset: vi.fn(),
}));

function fixture(assets = false) {
  const snapshot = {
    tables: assets ? { e_content: { columns: ["id", "url"], rows: [[id, sourceUrl]] } } : {},
    metadata: { capabilityCode: "CAP", levelCode: "L1" },
  };
  const version = {
    id,
    entity_type: "catalog",
    status: "VALIDATED",
    created_by: "original-uploader",
    draft_revision: 1,
    snapshot_data: snapshot,
    snapshot_hash: calculateHash(snapshot),
  };
  const db = new MemoryDb({ catalog_versions: [version] });
  const storage = {
    stageStream: vi.fn(
      async (
        download: Parameters<CatalogDependencies["publishOptions"]["storage"]["stageStream"]>[0],
      ) => ({
        ...(await download(async () => {})),
        key: "resources/file.pdf",
        publicUrl: "/api/admin/lte/assets?key=resources%2Ffile.pdf",
      }),
    ),
  };
  const options = { supabase: db, storage } as unknown as CatalogDependencies["publishOptions"];
  return { db, options, version };
}
beforeEach(() => {
  vi.mocked(publishSnapshotTables)
    .mockReset()
    .mockResolvedValue({
      inserted: 3,
      skipped: 1,
      tableSummary: { levels: { inserted: 3, skipped: 1 } },
    });
  vi.mocked(validateAndStreamAsset)
    .mockReset()
    .mockResolvedValue({
      originalUrl: sourceUrl,
      finalUrl: sourceUrl,
      contentHash: "a".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 8,
      result: undefined,
    });
});
afterEach(() => vi.useRealTimers());
describe("persisted publishing jobs", () => {
  it("does not take over a slow publisher after five minutes", async () => {
    const { db, options, version } = fixture();
    let resume!: () => void;
    let entered!: () => void;
    const paused = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(publishSnapshotTables).mockImplementationOnce(async () => {
      entered();
      await paused;
      return { inserted: 1, skipped: 0, tableSummary: {} };
    });
    const publishing = createPublishJob(version, actor.id, options);
    await started;
    const state = db.tables.catalog_versions[0].snapshot_data.assetValidation;
    const token = state.publishingToken;
    state.publishingStartedAt = new Date(Date.now() - 360001).toISOString();
    expect((await readPublishJobStatus(id, options)).job.status).toBe("PUBLISHING");
    await finalizePublishJob(id, undefined, options);
    expect(publishSnapshotTables).toHaveBeenCalledOnce();
    expect(db.tables.catalog_versions[0].snapshot_data.assetValidation.publishingToken).toBe(token);
    resume();
    expect((await publishing).job.status).toBe("PUBLISHED");
  });
  it.each([
    "ABANDONED",
    "ARCHIVED",
  ])("does not process or resurrect a %s catalog version", async (status) => {
    const { db, options, version } = fixture(true);
    const { messages } = await createPublishJob(version, actor.id, options);
    db.tables.catalog_versions[0].status = status;
    const state = db.tables.catalog_versions[0].snapshot_data.assetValidation;
    state.assets[sourceUrl].status = "VALID";
    await processAssetValidationMessage(messages[0]!, options);
    await markAssetValidationFailed(id, sourceUrl, new Error("late delivery"), options);
    await finalizePublishJobIfReady(id, options);
    await finalizePublishJob(id, actor.id, options);
    expect((await readPublishJobStatus(id, options)).job.status).toBe(status);
    await expect(
      createPublishJob(db.tables.catalog_versions[0], actor.id, options),
    ).rejects.toThrow("no longer editable");
    expect(publishSnapshotTables).not.toHaveBeenCalled();
    expect(options.storage.stageStream).not.toHaveBeenCalled();
    expect(validateAndStreamAsset).not.toHaveBeenCalled();
  });
  it("does not commit a publication if its version is discarded during table writes", async () => {
    const { db, options, version } = fixture();
    vi.mocked(publishSnapshotTables).mockImplementationOnce(async () => {
      db.tables.catalog_versions[0].status = "ABANDONED";
      return { inserted: 0, skipped: 0, tableSummary: {} };
    });
    await expect(createPublishJob(version, actor.id, options)).rejects.toThrow(
      "no longer editable",
    );
    expect(db.tables.catalog_versions[0].status).toBe("ABANDONED");
    expect(db.calls.filter((call) => call.operation === "insert")).toHaveLength(0);
  });
  it("does not let a failed concurrent delivery corrupt a validated or published asset", async () => {
    const { db, options, version } = fixture(true);
    const { messages } = await createPublishJob(version, actor.id, options);
    let fail!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(validateAndStreamAsset).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          entered();
          fail = () => reject(new Error("Late duplicate failed"));
        }),
    );
    const duplicate = processAssetValidationMessage(messages[0]!, options);
    await started;
    await processAssetValidationMessage(messages[0]!, options);
    fail();
    await duplicate;
    const state = db.tables.catalog_versions[0].snapshot_data.assetValidation;
    expect(state.status).toBe("PUBLISHED");
    expect(state.assets[sourceUrl].status).toBe("VALID");
    expect(state.failed).toBe(0);
  });
  it("publishes asset-free snapshots and records the publishing actor", async () => {
    const { db, options, version } = fixture();
    const { job, messages } = await createPublishJob(version, actor.id, options);
    expect(messages).toEqual([]);
    expect(job.status).toBe("PUBLISHED");
    expect(job.inserted_count).toBe(3);
    expect(db.tables.catalog_versions[0].published_by).toBe(actor.id);
    expect((await readPublishJobStatus(id, options)).job.status).toBe("PUBLISHED");
    await finalizePublishJob(id, actor.id, options);
    expect(publishSnapshotTables).toHaveBeenCalledOnce();
  });
  it("streams a validated asset, replaces its URL, and finalizes duplicate deliveries idempotently", async () => {
    const { db, options, version } = fixture(true);
    const { job, messages } = await createPublishJob(version, actor.id, options);
    expect(job.status).toBe("VALIDATING");
    expect(messages).toEqual([{ uploadId: id, assetUrl: sourceUrl }]);
    await processAssetValidationMessage(messages[0]!, options);
    const stored = db.tables.catalog_versions[0];
    expect(stored.status).toBe("PUBLISHED");
    expect(stored.published_by).toBe(actor.id);
    expect(stored.snapshot_data.tables.e_content.rows[0][1]).toBe(
      "/api/admin/lte/assets?key=resources%2Ffile.pdf",
    );
    expect(stored.snapshot_data.assetManifest[0]).toMatchObject({
      originalUrl: sourceUrl,
      sizeBytes: 8,
      status: "staged",
    });
    await processAssetValidationMessage(messages[0]!, options);
    expect(validateAndStreamAsset).toHaveBeenCalledOnce();
    expect(publishSnapshotTables).toHaveBeenCalledOnce();
  });
  it("persists a terminal publication failure and retries without corrupting a valid asset", async () => {
    const { db, options, version } = fixture(true);
    const { messages } = await createPublishJob(version, actor.id, options);
    vi.mocked(publishSnapshotTables).mockRejectedValueOnce(new Error("Tables unavailable"));
    await expect(processAssetValidationMessage(messages[0]!, options)).rejects.toThrow(
      "Tables unavailable",
    );
    const failed = await readPublishJobStatus(id, options);
    expect(failed.job.status).toBe("PUBLISH_FAILED");
    expect(failed.job.error_message).toBe("Tables unavailable");
    await markAssetValidationFailed(id, sourceUrl, new Error("retry exhaustion"), options);
    expect(
      db.tables.catalog_versions[0].snapshot_data.assetValidation.assets[sourceUrl].status,
    ).toBe("VALID");
    await processAssetValidationMessage(messages[0]!, options);
    expect((await readPublishJobStatus(id, options)).job.status).toBe("PUBLISHED");
    expect(validateAndStreamAsset).toHaveBeenCalledOnce();
  });
  it("does not recover a fresh publication lock after long validation", async () => {
    const { db, options, version } = fixture(true);
    await createPublishJob(version, actor.id, options);
    const state = db.tables.catalog_versions[0].snapshot_data.assetValidation;
    state.status = "PUBLISHING";
    state.startedAt = new Date(Date.now() - 3600000).toISOString();
    state.publishingStartedAt = new Date().toISOString();
    state.assets[sourceUrl].status = "VALID";
    expect((await readPublishJobStatus(id, options)).job.status).toBe("PUBLISHING");
    expect(publishSnapshotTables).not.toHaveBeenCalled();
    state.publishingStartedAt = new Date(Date.now() - 360001).toISOString();
    expect((await readPublishJobStatus(id, options)).job.status).toBe("PUBLISHING");
    await finalizePublishJob(id, undefined, options);
    expect(publishSnapshotTables).not.toHaveBeenCalled();
  });
  it("a superseded publisher cannot replace the new lock or its state", async () => {
    const { db, options, version } = fixture();
    vi.mocked(publishSnapshotTables).mockImplementationOnce(async () => {
      db.tables.catalog_versions[0].snapshot_data.assetValidation.publishingToken = "new-owner";
      return { inserted: 0, skipped: 0, tableSummary: {} };
    });
    await expect(createPublishJob(version, actor.id, options)).rejects.toThrow("superseded");
    expect(db.tables.catalog_versions[0].snapshot_data.assetValidation).toMatchObject({
      status: "PUBLISHING",
      publishingToken: "new-owner",
    });
  });
  it("rejects an unreviewed concurrent snapshot before creating a job", async () => {
    const { db, options, version } = fixture();
    db.tables.catalog_versions[0].draft_revision = 2;
    await expect(createPublishJob(version, actor.id, options)).rejects.toThrow("SNAPSHOT_CHANGED");
    expect(publishSnapshotTables).not.toHaveBeenCalled();
  });
  it("records validation errors without publishing and exposes failure details", async () => {
    const { options, version } = fixture(true);
    const { messages } = await createPublishJob(version, actor.id, options);
    vi.mocked(validateAndStreamAsset).mockRejectedValue(
      new AssetValidationError("DRIVE_NOT_PUBLIC", "File requires login"),
    );
    await processAssetValidationMessage(messages[0]!, options);
    const result = await readPublishJobStatus(id, options);
    expect(result.job.status).toBe("VALIDATION_FAILED");
    expect(result.assets[0]!).toMatchObject({
      status: "FAILED",
      error_code: "DRIVE_NOT_PUBLIC",
      error_message: "File requires login",
    });
    expect(publishSnapshotTables).not.toHaveBeenCalled();
  });
  it("resumes pending assets without downloading unrelated URLs", async () => {
    const { db, options, version } = fixture(true);
    await createPublishJob(version, actor.id, options);
    const resumed = await createPublishJob(db.tables.catalog_versions[0], actor.id, options);
    expect(resumed.messages).toHaveLength(1);
    await finalizePublishJobIfReady(id, options);
    expect(publishSnapshotTables).not.toHaveBeenCalled();
    await expect(
      processAssetValidationMessage(
        { uploadId: id, assetUrl: "https://example.com/other" },
        options,
      ),
    ).rejects.toThrow("not part");
    await markAssetValidationFailed(
      id,
      "https://example.com/other",
      new Error("exhausted"),
      options,
    );
    expect(validateAndStreamAsset).not.toHaveBeenCalled();
    await markAssetValidationFailed(id, sourceUrl, new Error("exhausted"), options);
    await finalizePublishJobIfReady(id, options);
    expect((await readPublishJobStatus(id, options)).job.status).toBe("VALIDATION_FAILED");
  });
  it("rejects missing dependencies and records", async () => {
    const { options, version, db } = fixture();
    await expect(createPublishJob(version, actor.id)).rejects.toThrow("database client");
    await expect(
      processAssetValidationMessage(
        { uploadId: id, assetUrl: sourceUrl },
        { supabase: options.supabase },
      ),
    ).rejects.toThrow("storage");
    db.tables.catalog_versions = [];
    await expect(readPublishJobStatus(id, options)).rejects.toThrow("not found");
  });
});
