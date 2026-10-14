/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAndStreamAsset } from "../ingestion/asset-validator";
import {
  generateStableAssetKey,
  type R2BucketLike,
  type R2ObjectLike,
  R2StorageService,
} from "../ingestion/r2-storage";

const HASH = "a".repeat(64);
const context = {
  capabilityCode: "CIE/CAP",
  levelCode: "L1",
  moduleNo: 2,
  artifactType: "practice" as const,
  originalUrl: "https://cdn.example.com/files/My.Workbook.Final.PDF?version=2",
  contentHash: HASH,
  mimeType: "application/pdf",
};

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

class MemoryBucket implements R2BucketLike {
  objects = new Map<string, { bytes: Uint8Array; options: any }>();
  failures = 0;
  maximumPartBytes = 0;
  aborted = 0;
  async createMultipartUpload(key: string, options: any = {}) {
    const parts = new Map<number, Uint8Array>();
    return {
      uploadPart: async (partNumber: number, bytes: Uint8Array) => {
        this.maximumPartBytes = Math.max(this.maximumPartBytes, bytes.length);
        parts.set(partNumber, bytes.slice());
        return { partNumber, etag: String(partNumber) };
      },
      complete: async () => {
        const size = [...parts.values()].reduce((sum, bytes) => sum + bytes.length, 0);
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts.values()) {
          bytes.set(part, offset);
          offset += part.length;
        }
        this.objects.set(key, { bytes, options });
      },
      abort: async () => {
        this.aborted++;
      },
    };
  }

  async put(key: string, value: Uint8Array | ReadableStream<Uint8Array>, options: any = {}) {
    if (this.failures-- > 0) throw new Error("temporary failure");
    let bytes = value as Uint8Array;
    if (value instanceof ReadableStream) {
      bytes = new Uint8Array(await new Response(value).arrayBuffer());
    }
    this.objects.set(key, { bytes, options });
  }
  async get(key: string): Promise<R2ObjectLike | null> {
    const item = this.objects.get(key);
    return item
      ? {
          body: stream(item.bytes),
          customMetadata: item.options.customMetadata,
          httpMetadata: item.options.httpMetadata,
        }
      : null;
  }
  async head(key: string) {
    const item = this.objects.get(key);
    return item ? { customMetadata: item.options.customMetadata } : null;
  }
  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

describe("R2StorageService", () => {
  it("streams a large download using bounded multipart buffers and preserves the stable key/hash", async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket);
    const chunk = new Uint8Array(1024 * 1024).fill(7);
    let remaining = 12;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (remaining--) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const download = (consume: Parameters<typeof validateAndStreamAsset>[1]) =>
      validateAndStreamAsset("https://example.com/large.mp4", consume, {
        dependencies: {
          resolve: async () => ["93.184.216.34"],
          fetch: async () => new Response(body, { headers: { "Content-Type": "video/mp4" } }),
        },
      });
    const result = await service.stageStream(download, {
      ...context,
      originalUrl: "https://example.com/large.mp4",
      uploadId: "large-upload",
    });
    const hash = createHash("sha256");
    for (let index = 0; index < 12; index++) hash.update(chunk);
    expect(result.contentHash).toBe(hash.digest("hex"));
    expect(result.sizeBytes).toBe(12 * 1024 * 1024);
    expect(bucket.maximumPartBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(bucket.objects.size).toBe(1);
    expect(bucket.objects.get(result.key)?.bytes.length).toBe(result.sizeBytes);
    expect([...bucket.objects.keys()].some((key) => key.includes(".staging"))).toBe(false);
  });
  it("aborts multipart staging and cleans temporary objects when a download fails", async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("Network lost"));
      },
    });
    await expect(
      service.stageStream(
        (consume) =>
          validateAndStreamAsset("https://example.com/file.pdf", consume, {
            dependencies: {
              resolve: async () => ["93.184.216.34"],
              fetch: async () =>
                new Response(body, { headers: { "Content-Type": "application/pdf" } }),
            },
          }),
        { ...context, uploadId: "failed" },
      ),
    ).rejects.toThrow("Network lost");
    expect(bucket.aborted).toBe(1);
    expect(bucket.objects.size).toBe(0);
  });
  it("generates stable taxonomy keys with a content-hash suffix", () => {
    const first = generateStableAssetKey(context);
    const second = generateStableAssetKey({ ...context });
    expect(first).toBe(second);
    expect(first).toBe(
      "resources/capabilities/CIE-CAP/levels/L1/modules-2/artifacts/practice/My-Workbook-Final-aaaaaaaaaaaaaaaa.pdf",
    );
  });

  it("stores learning content in the module content folder", () => {
    expect(generateStableAssetKey({ ...context, category: "content" })).toBe(
      "resources/capabilities/CIE-CAP/levels/L1/modules-2/content/My-Workbook-Final-aaaaaaaaaaaaaaaa.pdf",
    );
  });

  it("stores artifact templates under artifact type templates folder", () => {
    expect(
      generateStableAssetKey({
        ...context,
        category: "artifact",
        artifactType: "final",
        artifactSubfolder: "templates",
      }),
    ).toBe(
      "resources/capabilities/CIE-CAP/levels/L1/modules-2/artifacts/final/templates/My-Workbook-Final-aaaaaaaaaaaaaaaa.pdf",
    );
  });

  it("requires a complete SHA-256 digest", () => {
    expect(() => generateStableAssetKey({ ...context, contentHash: "not-a-hash" })).toThrow(
      "SHA-256",
    );
  });

  it("uploads staged bytes with metadata and retries temporary failures", async () => {
    const bucket = new MemoryBucket();
    bucket.failures = 2;
    const service = new R2StorageService(bucket);
    const result = await service.uploadAsset({
      ...context,
      bytes: new TextEncoder().encode("asset"),
      uploadId: "upload-1",
    });
    const stored = bucket.objects.get(result.key)!;

    expect(result.publicUrl).toBe(`/api/admin/lte/assets?key=${encodeURIComponent(result.key)}`);
    expect(stored.options.httpMetadata).toEqual({ contentType: "application/pdf" });
    expect(stored.options.customMetadata).toMatchObject({
      lifecycle: "staged",
      uploadId: "upload-1",
      originalUrl: context.originalUrl,
      contentHash: HASH,
    });
  });

  it("activates staged objects and treats active objects idempotently", async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket);
    const uploaded = await service.uploadAsset({
      ...context,
      bytes: new Uint8Array([1]),
      uploadId: "upload-1",
    });

    expect(await service.activateAssets([uploaded.key])).toEqual({ activated: 1, failedKeys: [] });
    expect(await service.activateAssets([uploaded.key])).toEqual({ activated: 0, failedKeys: [] });
    expect(bucket.objects.get(uploaded.key)?.options.customMetadata.lifecycle).toBe("active");
  });

  it("deletes only staged objects and preserves active objects", async () => {
    const bucket = new MemoryBucket();
    const service = new R2StorageService(bucket);
    const staged = await service.uploadAsset({
      ...context,
      bytes: new Uint8Array([1]),
      uploadId: "one",
    });
    const active = await service.uploadAsset({
      ...context,
      contentHash: "b".repeat(64),
      bytes: new Uint8Array([2]),
      uploadId: "two",
    });
    await service.activateAssets([active.key]);

    expect(await service.deleteStagedAssets([staged.key, active.key])).toEqual({
      deleted: 1,
      failedKeys: [],
    });
    expect(bucket.objects.has(staged.key)).toBe(false);
    expect(bucket.objects.has(active.key)).toBe(true);
  });
});
