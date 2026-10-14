import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  type AssetValidatorDependencies,
  isPrivateAddress,
  validateAndDownloadAsset,
  validateAssetBatch,
  validateAssetDestination,
} from "../ingestion/asset-validator";

const publicResolve = vi.fn(async () => ["93.184.216.34"]);

function dependencies(fetchImpl: typeof fetch): AssetValidatorDependencies {
  return { fetch: fetchImpl, resolve: publicResolve };
}

function assetResponse(body = "pdf data", headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/pdf", ...headers },
  });
}

describe("asset SSRF validation", () => {
  it("rejects every non-HTTPS protocol", async () => {
    for (const url of ["http://example.com/a.pdf", "file:///tmp/a.pdf", "data:text/plain,a"]) {
      await expect(validateAssetDestination(url)).rejects.toMatchObject({
        code: "INVALID_PROTOCOL",
      });
    }
  });

  it("blocks localhost, metadata domains, and private IPv4/IPv6 ranges", async () => {
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("172.31.1.2")).toBe(true);
    expect(isPrivateAddress("192.168.1.2")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    await expect(validateAssetDestination("https://localhost/a.pdf")).rejects.toMatchObject({
      code: "BLOCKED_DOMAIN",
    });
    await expect(
      validateAssetDestination("https://metadata.google.internal/a.pdf"),
    ).rejects.toMatchObject({ code: "BLOCKED_DOMAIN" });
  });

  it("rejects a public hostname if any DNS answer is private", async () => {
    await expect(
      validateAssetDestination("https://example.com/a.pdf", {
        fetch,
        resolve: async () => ["93.184.216.34", "127.0.0.1"],
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_IP" });
  });
});

describe("asset download validation", () => {
  it("revalidates redirect destinations and rejects redirects to private hosts", async () => {
    const mockedFetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://internal.example/a.pdf" },
        }),
    ) as unknown as typeof fetch;
    const deps = dependencies(mockedFetch);
    deps.resolve = async (hostname) =>
      hostname === "internal.example" ? ["10.0.0.1"] : ["93.184.216.34"];

    await expect(
      validateAndDownloadAsset("https://example.com/a.pdf", { dependencies: deps }),
    ).rejects.toMatchObject({ code: "PRIVATE_IP" });
  });

  it("enforces redirect limits", async () => {
    const mockedFetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/next.pdf" },
        }),
    ) as unknown as typeof fetch;
    await expect(
      validateAndDownloadAsset("https://example.com/a.pdf", {
        dependencies: dependencies(mockedFetch),
        maxRedirects: 1,
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("rejects MIME mismatches and oversized declared files", async () => {
    const wrongMime = vi.fn(async () =>
      assetResponse("x", { "content-type": "image/png" }),
    ) as unknown as typeof fetch;
    await expect(
      validateAndDownloadAsset("https://example.com/a.pdf", {
        dependencies: dependencies(wrongMime),
      }),
    ).rejects.toMatchObject({ code: "INVALID_MIME_TYPE" });

    const oversized = vi.fn(async () =>
      assetResponse("", { "content-length": String(51 * 1024 * 1024) }),
    ) as unknown as typeof fetch;
    await expect(
      validateAndDownloadAsset("https://example.com/a.pdf", {
        dependencies: dependencies(oversized),
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("streams content and returns its SHA-256, MIME type, and size", async () => {
    const mockedFetch = vi.fn(async () => assetResponse("pdf data")) as unknown as typeof fetch;
    const asset = await validateAndDownloadAsset("https://example.com/a.pdf", {
      dependencies: dependencies(mockedFetch),
    });

    expect(asset.sizeBytes).toBe(8);
    expect(asset.mimeType).toBe("application/pdf");
    expect(asset.contentHash).toBe(createHash("sha256").update("pdf data").digest("hex"));
  });

  it("downloads Google editor links through export URLs", async () => {
    const mockedFetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) =>
        new Response("deck data", {
          status: 200,
          headers: {
            "content-type":
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          },
        }),
    );
    const mockedFetch = mockedFetchMock as unknown as typeof fetch;

    const asset = await validateAndDownloadAsset(
      "https://docs.google.com/presentation/d/deck-id/edit?usp=sharing",
      {
        dependencies: dependencies(mockedFetch),
      },
    );

    expect(String(mockedFetchMock.mock.calls[0]![0])).toBe(
      "https://docs.google.com/presentation/d/deck-id/export/pptx",
    );
    expect(asset.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
  });

  it("falls back to Drive file-id downloads when the Google editor export returns HTML", async () => {
    const mockedFetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html>login</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(assetResponse("pdf fallback"));
    const mockedFetch = mockedFetchMock as unknown as typeof fetch;

    const asset = await validateAndDownloadAsset(
      "https://docs.google.com/presentation/d/deck-id/edit",
      {
        dependencies: dependencies(mockedFetch),
      },
    );

    expect(String(mockedFetchMock.mock.calls[0]![0])).toBe(
      "https://docs.google.com/presentation/d/deck-id/export/pptx",
    );
    expect(String(mockedFetchMock.mock.calls[1]![0])).toBe(
      "https://drive.google.com/uc?export=download&id=deck-id",
    );
    expect(asset.mimeType).toBe("application/pdf");
    expect(asset.contentHash).toBe(createHash("sha256").update("pdf fallback").digest("hex"));
  });

  it("enforces per-asset timeouts", async () => {
    const neverFetch = vi.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ) as unknown as typeof fetch;

    await expect(
      validateAndDownloadAsset("https://example.com/a.pdf", {
        dependencies: dependencies(neverFetch),
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: "DOWNLOAD_TIMEOUT" });
  });

  it("validates batches with bounded concurrency and aggregates errors", async () => {
    let active = 0;
    let maximum = 0;
    const mockedFetch = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return assetResponse("pdf data");
    }) as unknown as typeof fetch;
    const urls = Array.from({ length: 12 }, (_, index) => `https://example.com/${index}.pdf`);
    const results = await validateAssetBatch(urls, {
      concurrency: 3,
      dependencies: dependencies(mockedFetch),
    });

    expect(results.every((result) => result.valid)).toBe(true);
    expect(maximum).toBeLessThanOrEqual(3);
  });
});
