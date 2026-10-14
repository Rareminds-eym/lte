import type { PagesContext } from "../../shared/types";
import { boundedBody } from "./http";

/** Existing catalogue HMAC contract, scoped to the exact method/path/body. */
export function internalEndpoint(
  handle: (context: PagesContext, body: string) => Promise<Response>,
) {
  return async (context: PagesContext): Promise<Response> => {
    const secret = context.env.LTE_CATALOG_SYNC_SECRET;
    if (!secret || secret.length < 32)
      return Response.json({ error: "Catalog integration is not configured" }, { status: 503 });
    const timestamp = context.request.headers.get("x-lte-timestamp") || "";
    const signature = context.request.headers.get("x-lte-signature") || "";
    if (
      !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 60000 ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const body = await boundedBody(context.request, 16384);
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        Uint8Array.from(signature.match(/../g)!, (value) => parseInt(value, 16)),
        new TextEncoder().encode(
          `${context.request.method}\n${new URL(context.request.url).pathname}\n${timestamp}\n${body}`,
        ),
      );
      if (!valid) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const response = await handle(context, body);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      if (error instanceof RangeError)
        return Response.json({ error: "Request too large" }, { status: 413 });
      if (error instanceof SyntaxError)
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      return Response.json({ error: "Catalog operation unavailable" }, { status: 503 });
    }
  };
}
