import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { readPublishJobStatus } from "./ingestion/publish-job";
import Logger, { getErrorMessage } from "./logger";
export function createHandlers(dependencies: CatalogDependencies) {
  const authenticateSSORequest = dependencies.authenticate;

  const logger = new Logger("LTEPublishStatusAPI");

  async function GET(
    request: HttpRequest,
    { params }: { params: Promise<{ jobId: string }> },
  ): Promise<HttpResponse> {
    try {
      const { user, error: authError } = await authenticateSSORequest(request, [
        "super_admin",
        "platform_admin",
      ]);

      if (authError || !user) {
        return (
          authError ||
          HttpResponse.json(
            { success: false, error: "FORBIDDEN: Publish status requires admin access." },
            { status: 403 },
          )
        );
      }

      const { jobId } = await params;
      const { job, assets } = await readPublishJobStatus(jobId, dependencies.publishOptions);
      const failedAssets = assets.filter((asset) => asset.status === "FAILED");

      return HttpResponse.json({
        success: true,
        publishJobId: job.id,
        uploadId: job.upload_id,
        status: job.status,
        inserted: job.inserted_count || 0,
        skipped: job.skipped_count || 0,
        tableSummary: job.table_summary || {},
        completedAt: job.completed_at,
        error: job.error_message,
        assetValidation: {
          total: job.total_assets || assets.length,
          validated:
            job.validated_assets || assets.filter((asset) => asset.status === "VALID").length,
          failed: job.failed_assets || failedAssets.length,
          pending: assets.filter((asset) => ["PENDING", "VALIDATING"].includes(asset.status))
            .length,
        },
        failedAssets: failedAssets.map((asset) => ({
          url: asset.asset_url,
          errorCode: asset.error_code,
          error: asset.error_message,
          attempts: asset.attempt_count,
        })),
      });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error("Failed to read LTE publish status", { error: message });
      return HttpResponse.json({ success: false, error: message }, { status: 500 });
    }
  }
  return { GET };
}
