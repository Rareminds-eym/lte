import { z } from "zod";
import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { extractAssets } from "./ingestion/asset-extractor";
import { REQUIRED_LTE_TABLES } from "./ingestion/constants";
import { calculateHash } from "./ingestion/snapshot-serializer";
import Logger from "./logger";

const table = z
  .object({
    columns: z.array(z.string()).max(100),
    rows: z.array(z.array(z.unknown()).max(100)).max(10000),
  })
  .refine((value) => value.rows.every((row) => row.length === value.columns.length));
const payload = z
  .object({
    fileName: z.string().min(1).max(255),
    sourceFileHash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: z
      .object({
        uploadId: z.string().min(1).max(100),
        sourceType: z.enum(["xlsx", "google_sheets"]),
        sourceName: z.string().min(1).max(255),
        tables: z
          .record(z.string(), table)
          .refine((tables) =>
            Object.keys(tables).every((name) =>
              (REQUIRED_LTE_TABLES as readonly string[]).includes(name),
            ),
          ),
        metadata: z.record(z.string(), z.unknown()),
        snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
        reviewedSnapshotHash: z.string().optional(),
        courseMetadata: z.record(z.string(), z.unknown()),
        modules: z.array(z.record(z.string(), z.unknown())),
        levelCourses: z.array(z.record(z.string(), z.unknown())).optional(),
        validationReport: z.record(z.string(), z.unknown()),
        createdAt: z.string().datetime(),
        status: z.enum(["validated", "validation_failed"]),
      })
      // Queue state and publishing fields are owned by LTE, never upload inputs.
      .strict(),
  })
  .strict();
export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const logger = new Logger("CatalogUpload");
  async function POST(request: HttpRequest) {
    const parsed = payload.safeParse(await request.json());
    if (!parsed.success)
      return HttpResponse.json(
        { success: false, error: "Invalid upload snapshot" },
        { status: 400 },
      );
    const { snapshot, fileName, sourceFileHash } = parsed.data;
    if (
      Object.values(snapshot.tables).reduce((n, t) => n + t.rows.length, 0) > 10000 ||
      calculateHash({ tables: snapshot.tables, metadata: snapshot.metadata }) !==
        snapshot.snapshotHash
    )
      return HttpResponse.json(
        { success: false, error: "Invalid snapshot hash or row count" },
        { status: 400 },
      );
    const user = dependencies.user;
    try {
      extractAssets(snapshot);
    } catch (error) {
      return HttpResponse.json(
        { success: false, error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
    const { data: latestVersion, error: versionError } = await supabaseLTE
      .from("catalog_versions")
      .select("version_no")
      .eq("entity_type", "catalog")
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      logger.error("Failed to read latest catalog version", { error: versionError });
      throw new Error(`Database version lookup failed: ${versionError.message}`);
    }

    const nextVersionNo = (latestVersion?.version_no || 0) + 1;
    const versionStatus = snapshot.status === "validated" ? "VALIDATED" : "DRAFT";

    // Store the parsed upload as the next catalog version snapshot.
    const { data: uploadRecord, error: insertError } = await supabaseLTE
      .from("catalog_versions")
      .insert({
        entity_type: "catalog",
        entity_id: null,
        version_no: nextVersionNo,
        status: versionStatus,
        snapshot_hash: snapshot.snapshotHash,
        snapshot_data: {
          ...snapshot,
          sourceFileHash,
        },
        change_reason: `UPLOAD:${fileName}`,
        created_by: user.userId,
      })
      .select("id, status")
      .single();

    if (insertError) {
      logger.error("Failed to insert upload record", { error: insertError });
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    return HttpResponse.json({
      success: true,
      uploadId: uploadRecord.id,
      snapshot: {
        ...snapshot,
        uploadId: uploadRecord.id,
        draftRevision: 1,
        reviewedSnapshotHash: snapshot.snapshotHash,
        status: uploadRecord.status === "VALIDATED" ? "validated" : "validation_failed",
      },
    });
  }
  return { POST };
}
