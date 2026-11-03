import { afterEach, expect, it, vi } from "vitest";
import { createServiceSupabase } from "../supabase";

afterEach(() => vi.unstubAllGlobals());
it("bounds database fetches and propagates correlation without replacing auth headers", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("[]", { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  const correlation = {
    requestId: "a".repeat(32),
    traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
  };
  const client = createServiceSupabase(
    { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only-key" },
    correlation,
  );
  const { error } = await client.from("certificates").select("id");
  expect(error).toBeNull();
  const options = fetcher.mock.calls[0]?.[1];
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(options.headers.get("X-Request-Id")).toBe(correlation.requestId);
  expect(options.headers.get("traceparent")).toBe(correlation.traceparent);
  expect(options.headers.get("apikey")).toBe("test-only-key");
});
