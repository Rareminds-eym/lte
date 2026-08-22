import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { apiLogger } from "@functions/shared/logger";

const ALLOWED_RESOURCE_HOST = "bucket.lte.rareminds.in";
const ALLOWED_RESOURCE_PATH_PREFIX = "/resources/";
const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const getResourceUrl = (request: Request): URL | null => {
  const requestUrl = new URL(request.url);
  const resourceUrl = requestUrl.searchParams.get("url");
  if (!resourceUrl) return null;

  try {
    return new URL(resourceUrl);
  } catch {
    return null;
  }
};

const isAllowedResourceUrl = (url: URL): boolean =>
  url.protocol === "https:" &&
  url.hostname === ALLOWED_RESOURCE_HOST &&
  url.pathname.startsWith(ALLOWED_RESOURCE_PATH_PREFIX);

const getInlineFileName = (url: URL): string => {
  const fileName = decodeURIComponent(url.pathname.split("/").pop() || "resource");
  return fileName.replace(/[^\w .()-]/g, "_");
};

const getContentType = (resourceUrl: URL, upstreamResponse: Response): string => {
  const upstreamContentType = upstreamResponse.headers.get("Content-Type");
  if (resourceUrl.pathname.toLowerCase().endsWith(".pptx")) return PPTX_CONTENT_TYPE;
  return upstreamContentType || "application/octet-stream";
};

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const resourceUrl = getResourceUrl(context.request);

  if (!resourceUrl || !isAllowedResourceUrl(resourceUrl)) {
    return jsonError("Resource preview is not available for this file.", 400);
  }

  try {
    const upstreamResponse = await fetch(resourceUrl.toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstreamResponse.ok || !upstreamResponse.body) {
      apiLogger.warn("Upstream preview fetch returned non-200", {
        status: upstreamResponse.status,
        url: resourceUrl.toString(),
      });
      return jsonError("Resource preview is not available right now.", 502);
    }

    const headers = new Headers();
    headers.set("Content-Type", getContentType(resourceUrl, upstreamResponse));
    headers.set("Content-Disposition", `inline; filename="${getInlineFileName(resourceUrl)}"`);
    headers.set(
      "Cache-Control",
      upstreamResponse.headers.get("Cache-Control") || "public, max-age=300",
    );

    const contentLength = upstreamResponse.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    apiLogger.error("Failed to proxy resource preview", error, {
      url: resourceUrl.toString(),
    });
    return jsonError("Resource preview is not available right now.", 502);
  }
}
