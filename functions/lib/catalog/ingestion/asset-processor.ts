/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import Logger from "../logger";
import { type AssetOccurrence, extractAssets } from "./asset-extractor";
import { resolveAssetStorageContext } from "./asset-storage-context";
import { AssetValidationError, validateAndStreamAsset } from "./asset-validator";
import type { R2StorageService } from "./r2-storage";
import { calculateHash } from "./snapshot-serializer";

const logger = new Logger("LTEAssetProcessor");

export interface AssetManifestEntry {
  originalUrl: string;
  r2Key: string;
  r2Url: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  status: "staged";
  occurrences: AssetOccurrence[];
}

export interface AssetProcessingResult {
  finalSnapshot: any;
  finalSnapshotHash: string;
  assetManifest: AssetManifestEntry[];
  hasAssets: boolean;
}

export function replaceOccurrence(
  snapshot: any,
  occurrence: AssetOccurrence,
  replacement: string,
): void {
  const table = snapshot.tables?.[occurrence.tableName];
  const row = table?.rows?.[occurrence.rowIndex];
  if (!table || !row) throw new Error(`Asset field no longer exists: ${occurrence.fieldPath}`);
  const configuredPath = occurrence.fieldPath.split(`rows.${occurrence.rowIndex}.`)[1];
  if (!configuredPath) throw new Error("Invalid asset field path");
  const [columnName, ...nested] = configuredPath.split(".");
  const columnIndex = table.columns.indexOf(columnName);
  if (columnIndex < 0) throw new Error(`Asset column no longer exists: ${columnName}`);
  if (nested.length === 0) {
    row[columnIndex] = replacement;
    return;
  }
  let target = row[columnIndex];
  for (const segment of nested.slice(0, -1)) target = target?.[segment];
  if (!target || typeof target !== "object")
    throw new Error(`Asset nested path no longer exists: ${occurrence.fieldPath}`);
  target[nested[nested.length - 1]!] = replacement;
}

export async function processSnapshotAssets(
  snapshot: any,
  uploadId: string,
  storage: R2StorageService,
  heartbeat?: () => Promise<void>,
): Promise<AssetProcessingResult> {
  const finalSnapshot = structuredClone(snapshot);
  const references = extractAssets(finalSnapshot);
  const assetManifest: AssetManifestEntry[] = [];
  const failures: Array<{ url: string; errorCode: string; error: string }> = [];
  logger.info("Staging extracted assets", { uploadId, count: references.length });
  for (const reference of references) {
    try {
      const uploaded = await storage.stageStream(
        (consume) => validateAndStreamAsset(reference.originalUrl, consume),
        {
          capabilityCode:
            snapshot.courseMetadata?.capabilityCode ||
            snapshot.metadata?.capabilityCode ||
            "CAPABILITY",
          levelCode:
            snapshot.levelCourses?.[0]?.levelCode || snapshot.metadata?.levelCode || "LEVEL",
          ...resolveAssetStorageContext(snapshot, reference),
          originalUrl: reference.originalUrl,
          uploadId,
        },
      );
      for (const occurrence of reference.occurrences)
        replaceOccurrence(finalSnapshot, occurrence, uploaded.publicUrl);
      assetManifest.push({
        originalUrl: reference.originalUrl,
        r2Key: uploaded.key,
        r2Url: uploaded.publicUrl,
        contentHash: uploaded.contentHash,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        status: "staged",
        occurrences: reference.occurrences,
      });
    } catch (error) {
      failures.push({
        url: reference.originalUrl,
        errorCode: error instanceof AssetValidationError ? error.code : "DOWNLOAD_FAILED",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await heartbeat?.();
  }
  if (failures.length) {
    await storage.deleteStagedAssets(assetManifest.map((asset) => asset.r2Key));
    const error = new Error(
      `ASSET_VALIDATION_FAILED (${failures.length} file(s)): ${failures
        .slice(0, 3)
        .map((item) => `${item.url} (${item.errorCode}: ${item.error})`)
        .join(", ")}`,
    );
    (error as any).details = failures;
    throw error;
  }
  return {
    finalSnapshot,
    finalSnapshotHash: calculateHash(finalSnapshot),
    assetManifest,
    hasAssets: references.length > 0,
  };
}
