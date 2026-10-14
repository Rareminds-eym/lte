import { describe, expect, it, vi } from "vitest";
import type { LteEnv, PagesContext } from "../../../shared/types";
import { internalEndpoint } from "../internal-auth";

const secret = "test-secret-longer-than-thirty-two-characters";
async function signed(path: string, body = "{}", timestamp = String(Date.now())) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`POST\n${path}\n${timestamp}\n${body}`),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return new Request(`https://lte.example.com${path}`, {
    method: "POST",
    body,
    headers: { "x-lte-timestamp": timestamp, "x-lte-signature": signature },
  });
}
function context(request: Request): PagesContext {
  return {
    request,
    env: { LTE_CATALOG_SYNC_SECRET: secret } as LteEnv,
    params: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}
describe("catalog machine boundary", () => {
  it("accepts only the exact signed method, path and bytes, within the existing freshness window", async () => {
    const handle = vi.fn(async () => Response.json({ success: true }));
    const endpoint = internalEndpoint(handle);
    const request = await signed("/api/v1/internal/catalog/export");
    expect((await endpoint(context(request))).status).toBe(200);
    expect(handle).toHaveBeenCalledOnce();
    const changedBody = await signed("/api/v1/internal/catalog/export");
    expect(
      (
        await endpoint(
          context(
            new Request(changedBody.url, {
              method: "POST",
              headers: changedBody.headers,
              body: "{} ",
            }),
          ),
        )
      ).status,
    ).toBe(401);
    const changedPath = await signed("/api/v1/internal/catalog/export");
    expect(
      (
        await endpoint(
          context(
            new Request("https://lte.example.com/api/v1/internal/catalog/process-asset", {
              method: "POST",
              headers: changedPath.headers,
              body: await changedPath.text(),
            }),
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await endpoint(
          context(
            await signed("/api/v1/internal/catalog/export", "{}", String(Date.now() - 61000)),
          ),
        )
      ).status,
    ).toBe(401);
    expect(handle).toHaveBeenCalledOnce();
  });
  it("bounds signed request bodies before invoking catalog operations", async () => {
    const handle = vi.fn(async () => new Response());
    const endpoint = internalEndpoint(handle);
    expect(
      (await endpoint(context(await signed("/api/v1/internal/catalog/export", "a".repeat(16385)))))
        .status,
    ).toBe(413);
    expect(handle).not.toHaveBeenCalled();
  });
});
