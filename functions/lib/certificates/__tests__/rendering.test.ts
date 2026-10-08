import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCredentialId, isValidCredentialId } from "../credential-id";
import { resolveLearnerName } from "../learner-name";
import {
  PdfRenderRateLimitedError,
  PdfRenderTimeoutError,
  PdfRenderUpstreamError,
  renderPdf,
} from "../pdf-renderer";
import { certificateHtml, escapeHtml, verifyUrl } from "../template";
import { env, row } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());
it("creates 80-bit Crockford credentials from secure randomness", () => {
  const random = vi.spyOn(crypto, "getRandomValues");
  const ids = Array.from({ length: 500 }, generateCredentialId);
  expect(new Set(ids).size).toBe(500);
  expect(ids.every(isValidCredentialId)).toBe(true);
  expect(random).toHaveBeenCalledWith(expect.any(Uint8Array));
  expect(random.mock.calls[0]?.[0].byteLength).toBe(10);
  for (const id of ["LTE-000000000000000I", "lte-0123456789ABCDEF", "LTE-1"])
    expect(isValidCredentialId(id)).toBe(false);
  random.mockRestore();
});
it("resolves human names without using email", () => {
  expect(resolveLearnerName({})).toBeNull();
  expect(resolveLearnerName({ first_name: " \n", last_name: null })).toBeNull();
  expect(resolveLearnerName({ first_name: "  Ada \n Marie ", last_name: " Lovelace " })).toBe(
    "Ada Marie Lovelace",
  );
  expect(resolveLearnerName({ first_name: "x".repeat(300) })?.length).toBe(255);
});
it("escapes every field and prints only a clickable verification link", () => {
  expect(escapeHtml(`<script a="&'">`)).toBe("&lt;script a=&quot;&amp;&#39;&quot;&gt;");
  const html = certificateHtml(
    { ...row, learner_name: '<script>alert("x")</script>', subtitle: "A&B" },
    env.CERTIFICATE_VERIFY_BASE_URL,
  );
  expect(html).not.toContain("<script>");
  expect(html).toContain("A&amp;B");
  expect(html).toContain(`href="${env.CERTIFICATE_VERIFY_BASE_URL}/${row.credential_id}"`);
  expect(html).not.toMatch(/(?:src=|url\()["']?https?:/);
  expect(html).not.toContain(userEmail());
  expect(
    certificateHtml(
      { ...row, certificate_type: "role_readiness" },
      env.CERTIFICATE_VERIFY_BASE_URL,
    ),
  ).toContain("Certificate of Role Readiness");
  expect(() => verifyUrl("javascript:alert", row.credential_id)).toThrow();
});
function userEmail() {
  return "ada@example.com";
}
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
