import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PdfRenderRateLimitedError,
  PdfRenderTimeoutError,
  PdfRenderUpstreamError,
  renderPdf,
} from "../pdfRenderer";
import { env } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());
describe("PDF renderer", () => {
  it("sends the account-scoped request and validates the PDF", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("%PDF-1.7 sample", { headers: { "Content-Type": "application/pdf" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect((await renderPdf(env, "<html/>")).byteLength).toBeGreaterThan(5);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-run/pdf`,
    );
    const options = fetcher.mock.calls[0]?.[1];
    expect(options.headers.Authorization).toBe(`Bearer ${env.BROWSER_RENDERING_API_TOKEN}`);
    expect(JSON.parse(options.body)).toMatchObject({
      rejectRequestPattern: ["^https?://.*"],
      setJavaScriptEnabled: false,
      pdfOptions: { landscape: true },
    });
  });
  it.each([429, 500, 403])("maps HTTP %s", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("upstream private body", { status, headers: { "Retry-After": "12" } }),
        ),
    );
    await expect(renderPdf(env, "html")).rejects.toBeInstanceOf(
      status === 429 ? PdfRenderRateLimitedError : PdfRenderUpstreamError,
    );
  });
  it.each(["wrong", "2099-01-01", "0"])("handles Retry-After %s", async (value) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": value } })),
    );
    await expect(renderPdf(env, "html")).rejects.toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
  });
  it("maps timeouts and network failures without leaking the token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("expired", "TimeoutError")));
    await expect(renderPdf(env, "html")).rejects.toBeInstanceOf(PdfRenderTimeoutError);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(env.BROWSER_RENDERING_API_TOKEN)));
    await expect(renderPdf(env, "html")).rejects.toThrow("PDF renderer unavailable");
  });
  it.each([
    ["text/html", "%PDF-1"],
    ["application/pdf", "not pdf"],
    ["application/pdf", `%PDF-${"x".repeat(5 * 1024 * 1024)}`],
  ])("rejects invalid PDFs", async (type, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": type } })),
    );
    await expect(renderPdf(env, "html")).rejects.toBeInstanceOf(PdfRenderUpstreamError);
  });
  it("rejects missing renderer configuration", async () => {
    await expect(renderPdf({}, "html")).rejects.toBeInstanceOf(PdfRenderUpstreamError);
  });
});
