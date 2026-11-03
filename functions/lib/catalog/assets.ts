import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import Logger, { getErrorMessage } from "./logger";

export function createHandlers(dependencies: Pick<CatalogDependencies, "bucket">) {
  const getR2Bucket = async () => dependencies.bucket;

  const logger = new Logger("LTEAssetsAPI");

  function isAllowedAssetKey(key: string): boolean {
    return key.startsWith("resources/") && !key.includes("..") && !key.startsWith("/");
  }

  async function GET(request: HttpRequest): Promise<HttpResponse> {
    try {
      const key = request.nextUrl.searchParams.get("key") || "";
      if (!key || !isAllowedAssetKey(key)) {
        return HttpResponse.json({ success: false, error: "Invalid asset key" }, { status: 400 });
      }

      const bucket = await getR2Bucket();
      const object = await bucket.get(key);
      if (!object) {
        return HttpResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
      }

      return new HttpResponse(object.body, {
        status: 200,
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      logger.error("Failed to serve LTE asset", { error: errorMessage });
      return HttpResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }
  return { GET };
}
