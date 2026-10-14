import { createHandlers } from "../../../lib/catalog/assets";
import { catalogRequest } from "../../../lib/catalog/http";
import type { R2BucketLike } from "../../../lib/catalog/ingestion/r2-storage";
import type { PagesContext } from "../../../shared/types";
export async function onRequestGet(context: PagesContext) {
  const response = await createHandlers({
    bucket: context.env.STORAGE_BUCKET as unknown as R2BucketLike,
  }).GET(catalogRequest(context.request));
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
