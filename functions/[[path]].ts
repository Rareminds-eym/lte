import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";

const ASSET_PATH_PATTERN = /\.[a-z0-9]{2,5}$/i;

// SPA fallback: client routes get the app shell with 200, unknown /api/*
// routes keep JSON 404s, and missing files that look like assets 404.
// Static assets that exist are passed through untouched via ASSETS.
export const onRequest = async ({ request, env }: PagesContext<LteEnv>) => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith("/api/")) {
    return jsonError("Not Found", 404);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Not Found", { status: 404 });
  }

  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;

  if (ASSET_PATH_PATTERN.test(pathname)) return asset;

  return env.ASSETS.fetch(new URL("/index.html", url));
};
