import { describe, expect, it, vi } from "vitest";
import { processSnapshotAssets, replaceOccurrence } from "../ingestion/asset-processor";
import type { R2StorageService } from "../ingestion/r2-storage";
import { sourceUrl } from "./fixtures";

describe("snapshot asset replacement", () => {
  it("streams one download for duplicate occurrences and preserves the source snapshot", async () => {
    const source = {
      tables: {
        artifact_questions: {
          columns: ["reference_url", "solution_url"],
          rows: [[sourceUrl, sourceUrl]],
        },
      },
    };
    const stageStream = vi.fn(async () => ({
      key: "resources/file.pdf",
      publicUrl: "/api/admin/lte/assets?key=resources%2Ffile.pdf",
      contentHash: "a".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 3,
    }));
    const heartbeat = vi.fn(async () => {});
    const result = await processSnapshotAssets(
      source,
      "upload",
      { stageStream } as unknown as R2StorageService,
      heartbeat,
    );
    expect(stageStream).toHaveBeenCalledOnce();
    expect(heartbeat).toHaveBeenCalledOnce();
    expect(result.finalSnapshot.tables.artifact_questions.rows[0]).toEqual([
      "/api/admin/lte/assets?key=resources%2Ffile.pdf",
      "/api/admin/lte/assets?key=resources%2Ffile.pdf",
    ]);
    expect(source.tables.artifact_questions.rows[0]).toEqual([sourceUrl, sourceUrl]);
    expect(result.assetManifest[0]?.occurrences).toHaveLength(2);
  });
  it("cleans successfully staged objects if another file fails", async () => {
    const snapshot = {
      tables: {
        e_content: {
          columns: ["url"],
          rows: [[sourceUrl], ["https://drive.google.com/file/d/other/view"]],
        },
      },
    };
    const stageStream = vi
      .fn()
      .mockResolvedValueOnce({
        key: "resources/file.pdf",
        publicUrl: "/api/admin/lte/assets?key=resources/file.pdf",
        contentHash: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 3,
      })
      .mockRejectedValueOnce(new Error("File unavailable"));
    const deleteStagedAssets = vi.fn(async () => ({ deleted: 1, failedKeys: [] }));
    await expect(
      processSnapshotAssets(snapshot, "upload", {
        stageStream,
        deleteStagedAssets,
      } as unknown as R2StorageService),
    ).rejects.toThrow("ASSET_VALIDATION_FAILED");
    expect(deleteStagedAssets).toHaveBeenCalledWith(["resources/file.pdf"]);
  });
  it("handles an asset-free snapshot without storage calls", async () => {
    const result = await processSnapshotAssets({ tables: {} }, "upload", {} as R2StorageService);
    expect(result.hasAssets).toBe(false);
  });
  it("replaces nested URLs and rejects missing or invalid persisted paths", () => {
    const snapshot = {
      tables: {
        e_content: { columns: ["learning_content"], rows: [[{ context: { link: sourceUrl } }]] },
      },
    };
    const occurrence = {
      tableName: "e_content",
      rowIndex: 0,
      fieldPath: "tables.e_content.rows.0.learning_content.context.link",
    };
    replaceOccurrence(snapshot, occurrence, "/asset");
    expect(snapshot.tables.e_content.rows[0]?.[0]?.context.link).toBe("/asset");
    for (const broken of [
      { ...occurrence, rowIndex: 9 },
      { ...occurrence, fieldPath: "invalid" },
      { ...occurrence, fieldPath: "tables.e_content.rows.0.missing" },
      { ...occurrence, fieldPath: "tables.e_content.rows.0.learning_content.missing.link" },
    ]) {
      expect(() => replaceOccurrence(snapshot, broken, "/asset")).toThrow();
    }
  });
});
