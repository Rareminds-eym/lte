import { z } from "zod";
import {
  finalizePublishJobIfReady,
  markAssetValidationFailed,
  processAssetValidationMessage,
} from "../../../../lib/catalog/ingestion/publish-job";
import { type R2BucketLike, R2StorageService } from "../../../../lib/catalog/ingestion/r2-storage";
import { internalEndpoint } from "../../../../lib/catalog/internal-auth";
import { createServiceSupabase } from "../../../../lib/supabase";

const schema = z
  .object({
    uploadId: z.string().uuid(),
    assetUrl: z.string().url().max(8192),
    attempts: z.number().int().min(1).max(100),
  })
  .strict();
export const onRequestPost = internalEndpoint(async (context, body) => {
  const payload = schema.safeParse(JSON.parse(body));
  if (!payload.success) return Response.json({ error: "Invalid asset job" }, { status: 400 });
  const { attempts, ...message } = payload.data;
  const options = {
    supabase: createServiceSupabase(context.env),
    storage: new R2StorageService(context.env.STORAGE_BUCKET as unknown as R2BucketLike),
  };
  const { data: version, error: versionError } = await options.supabase
    .from("catalog_versions")
    .select("snapshot_data, status")
    .eq("id", message.uploadId)
    .eq("entity_type", "catalog")
    .maybeSingle();
  if (versionError) throw new Error("Publish job lookup failed");
  const assets = version?.snapshot_data?.assetValidation?.assets;
  if (!assets || !Object.hasOwn(assets, message.assetUrl))
    return Response.json(
      { success: false, error: "Asset is not part of this publish job" },
      { status: 400 },
    );
  if (!["DRAFT", "VALIDATED"].includes(version.status))
    return Response.json({ success: true, skipped: true });
  try {
    await processAssetValidationMessage(message, options);
    return Response.json({ success: true });
  } catch (error) {
    if (attempts < 3)
      return Response.json({ success: false, error: "Asset processing failed" }, { status: 503 });
    await markAssetValidationFailed(message.uploadId, message.assetUrl, error, options);
    const { data: latest } = await options.supabase
      .from("catalog_versions")
      .select("snapshot_data")
      .eq("id", message.uploadId)
      .single();
    if (latest?.snapshot_data?.assetValidation?.status !== "PUBLISH_FAILED")
      await finalizePublishJobIfReady(message.uploadId, options);
    return Response.json({ success: true, exhausted: true });
  }
});
