/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { createPublishJob, type LTEAssetValidationMessage } from "./ingestion/publish-job";
import { calculateHash } from "./ingestion/snapshot-serializer";
import Logger, { getErrorMessage } from "./logger";
import type { LTEPublishResult } from "./types";

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTEPublishAPI");
  const QUEUE_SEND_BATCH_LIMIT = 100;

  interface PublishRequest {
    uploadId: string;
    reviewedSnapshotHash: string;
  }

  interface QueueLike<T> {
    sendBatch(messages: Array<{ body: T }>): Promise<void>;
  }

  async function POST(request: HttpRequest): Promise<HttpResponse<LTEPublishResult>> {
    logger.info("Received LTE publish request");

    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "super_admin",
        "platform_admin",
      ]);

      if (authError || !user) {
        logger.warn("Authentication failure during publish attempt");
        return (
          authError ||
          HttpResponse.json(
            {
              success: false,
              status: "rejected",
              inserted: 0,
              skipped: 0,
              completedAt: new Date().toISOString(),
              error: "FORBIDDEN: Publish requires super_admin or platform_admin role.",
            },
            { status: 403 },
          )
        );
      }

      const body = (await request.json()) as PublishRequest;
      if (!body.uploadId || !body.reviewedSnapshotHash) {
        return HttpResponse.json(
          {
            success: false,
            status: "rejected",
            inserted: 0,
            skipped: 0,
            completedAt: new Date().toISOString(),
            error: "Missing uploadId or reviewedSnapshotHash in request body",
          },
          { status: 400 },
        );
      }

      const { data: version, error: fetchError } = await supabaseLTE
        .from("catalog_versions")
        .select("*")
        .eq("id", body.uploadId)
        .eq("entity_type", "catalog")
        .single();

      if (fetchError || !version) {
        logger.error("Catalog version not found", { uploadId: body.uploadId, error: fetchError });
        return HttpResponse.json(
          {
            success: false,
            status: "rejected",
            inserted: 0,
            skipped: 0,
            completedAt: new Date().toISOString(),
            error: "Catalog version not found",
          },
          { status: 404 },
        );
      }

      if (version.status === "PUBLISHED") {
        return HttpResponse.json({
          success: true,
          status: "published",
          catalogPublished: true,
          inserted: 0,
          skipped: 0,
          completedAt: version.published_at || new Date().toISOString(),
        });
      }

      if (!["VALIDATED", "DRAFT"].includes(version.status)) {
        return HttpResponse.json(
          {
            success: false,
            status: "rejected",
            inserted: 0,
            skipped: 0,
            completedAt: new Date().toISOString(),
            error: `Catalog version status is ${version.status}; expected VALIDATED or DRAFT.`,
          },
          { status: 409 },
        );
      }

      const snapshot = version.snapshot_data;
      const normalizedSnapshot = {
        tables: snapshot?.tables || {},
        metadata: snapshot?.metadata || {},
      };
      const recomputedHash = calculateHash(normalizedSnapshot as any);

      if (
        recomputedHash !== version.snapshot_hash ||
        body.reviewedSnapshotHash !== version.snapshot_hash
      ) {
        logger.warn("Catalog version hash mismatch", {
          uploadId: body.uploadId,
          storedHash: version.snapshot_hash,
          requestedHash: body.reviewedSnapshotHash,
          recomputedHash,
        });

        return HttpResponse.json(
          {
            success: false,
            status: "rejected",
            inserted: 0,
            skipped: 0,
            completedAt: new Date().toISOString(),
            errorCode: "SNAPSHOT_CHANGED",
            error:
              "SNAPSHOT_CHANGED: The reviewed snapshot version changed. Please refresh and review again.",
          },
          { status: 409 },
        );
      }

      const { job, messages } = await createPublishJob(
        version,
        user.userId,
        dependencies.publishOptions,
      );

      if (messages.length > 0) {
        const queue = await getAssetValidationQueue();
        if (!queue) {
          throw new Error(
            "LTE_ASSET_VALIDATION_QUEUE is not configured. Add the queue producer binding before publishing assets.",
          );
        }

        for (let index = 0; index < messages.length; index += QUEUE_SEND_BATCH_LIMIT) {
          const chunk = messages.slice(index, index + QUEUE_SEND_BATCH_LIMIT);
          const batchNumber = Math.floor(index / QUEUE_SEND_BATCH_LIMIT) + 1;
          try {
            await queue.sendBatch(chunk.map((message) => ({ body: message })));
          } catch (error) {
            logger.error("LTE asset validation queue batch failed", {
              uploadId: body.uploadId,
              batchNumber,
              batchSize: chunk.length,
              error: getErrorMessage(error),
            });
            throw error;
          }
        }

        logger.info("LTE asset validation job queued", {
          uploadId: body.uploadId,
          publishJobId: job.id,
          totalAssets: messages.length,
        });

        return HttpResponse.json({
          success: true,
          status: "validating_assets",
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          assetStatus: "validation_pending",
          publishJobId: job.id,
          assetValidation: {
            total: job.total_assets || messages.length,
            validated: job.validated_assets || 0,
            failed: job.failed_assets || 0,
          },
        } as LTEPublishResult & Record<string, unknown>);
      }

      logger.info("LTE catalog version published successfully", {
        uploadId: body.uploadId,
        inserted: job.inserted_count || 0,
        skipped: job.skipped_count || 0,
      });

      return HttpResponse.json({
        success: true,
        status: "published",
        catalogPublished: true,
        inserted: job.inserted_count || 0,
        skipped: job.skipped_count || 0,
        tableSummary: job.table_summary || {},
        completedAt: job.completed_at || new Date().toISOString(),
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("LTE Publish unexpected failure", { error: errorMessage });

      return HttpResponse.json(
        {
          success: false,
          status: errorMessage.startsWith("SNAPSHOT_CHANGED:") ? "rejected" : "publish_failed",
          errorCode: errorMessage.startsWith("SNAPSHOT_CHANGED:") ? "SNAPSHOT_CHANGED" : undefined,
          inserted: 0,
          skipped: 0,
          completedAt: new Date().toISOString(),
          error: errorMessage,
        },
        { status: errorMessage.startsWith("SNAPSHOT_CHANGED:") ? 409 : 500 },
      );
    }
  }

  async function getAssetValidationQueue(): Promise<QueueLike<LTEAssetValidationMessage> | null> {
    return dependencies.env.LTE_ASSET_VALIDATION_QUEUE || null;
  }

  return { POST };
}
