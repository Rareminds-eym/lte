import { CERTIFICATE_CONFIG } from "./config";

export class PdfRenderRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("PDF renderer busy");
  }
}
export class PdfRenderTimeoutError extends Error {}
export class PdfRenderUpstreamError extends Error {
  constructor(public readonly status: number) {
    super("PDF renderer unavailable");
  }
}
export async function renderPdf(
  env: { CF_ACCOUNT_ID?: string; BROWSER_RENDERING_API_TOKEN?: string },
  html: string,
  correlation?: { requestId: string; traceparent?: string },
): Promise<ArrayBuffer> {
  if (
    !env.CF_ACCOUNT_ID ||
    !/^[a-f0-9]{32}$/i.test(env.CF_ACCOUNT_ID) ||
    !env.BROWSER_RENDERING_API_TOKEN
  )
    throw new PdfRenderUpstreamError(503);
  const signal = AbortSignal.timeout(CERTIFICATE_CONFIG.rendererTimeoutMs);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-run/pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,
          "Content-Type": "application/json",
          ...(correlation?.requestId ? { "X-Request-Id": correlation.requestId } : {}),
          ...(correlation?.traceparent ? { traceparent: correlation.traceparent } : {}),
        },
        body: JSON.stringify({
          html,
          pdfOptions: {
            format: "a4",
            landscape: true,
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          },
          rejectRequestPattern: ["^https?://.*"],
          setJavaScriptEnabled: false,
        }),
        signal,
      },
    );
    if (response.status === 429) {
      const header = response.headers.get("Retry-After");
      const seconds =
        header && /^\d+$/.test(header)
          ? Number(header)
          : header
            ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
            : 60;
      throw new PdfRenderRateLimitedError(
        Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 3600)) : 60,
      );
    }
    if (!response.ok) throw new PdfRenderUpstreamError(response.status);
    const body = await response.arrayBuffer();
    if (
      body.byteLength > 5 * 1024 * 1024 ||
      !response.headers.get("Content-Type")?.toLowerCase().includes("application/pdf") ||
      new TextDecoder().decode(body.slice(0, 5)) !== "%PDF-"
    )
      throw new PdfRenderUpstreamError(502);
    return body;
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
    )
      throw new PdfRenderTimeoutError("PDF renderer timed out");
    if (error instanceof PdfRenderRateLimitedError || error instanceof PdfRenderUpstreamError)
      throw error;
    throw new PdfRenderUpstreamError(502);
  }
}
