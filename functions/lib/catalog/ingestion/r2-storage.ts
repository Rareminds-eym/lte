import { basename, extname } from "node:path";

export interface R2ObjectLike {
  body: ReadableStream<Uint8Array>;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string; [key: string]: unknown };
}

export interface R2HeadLike {
  customMetadata?: Record<string, string>;
}

export interface R2BucketLike {
  createMultipartUpload?(
    key: string,
    options?: Record<string, unknown>,
  ): Promise<{
    uploadPart(
      partNumber: number,
      bytes: Uint8Array,
    ): Promise<{ partNumber: number; etag: string }>;
    complete(parts: Array<{ partNumber: number; etag: string }>): Promise<unknown>;
    abort(): Promise<void>;
  }>;
  put(
    key: string,
    value: Uint8Array | ReadableStream<Uint8Array>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2HeadLike | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface AssetKeyContext {
  capabilityCode: string;
  levelCode: string;
  moduleNo: number;
  category?: "content" | "artifact" | "catalog";
  artifactType?: string;
  artifactSubfolder?: "templates" | "questions";
  originalUrl: string;
  contentHash: string;
  mimeType: string;
}

export interface UploadAssetInput extends AssetKeyContext {
  bytes: Uint8Array;
  uploadId: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "audio/mpeg": ".mp3",
  "application/json": ".json",
  "application/zip": ".zip",
};

function safeSegment(value: string, fallback: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function safeFilename(context: AssetKeyContext): string {
  let urlName = "";
  try {
    urlName = decodeURIComponent(basename(new URL(context.originalUrl).pathname));
  } catch {
    /* fallback */
  }
  const urlExtension = extname(urlName).toLowerCase();
  const extension = /^\.[a-z0-9]{1,8}$/.test(urlExtension)
    ? urlExtension
    : EXTENSION_BY_MIME[context.mimeType] || ".bin";
  const stem = safeSegment(urlName.slice(0, urlName.length - urlExtension.length), "asset").slice(
    0,
    80,
  );
  const hash = context.contentHash.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error("contentHash must be a 64-character SHA-256 hex digest");
  return `${stem}-${hash.slice(0, 16)}${extension}`;
}

export function generateStableAssetKey(context: AssetKeyContext): string {
  const capability = safeSegment(context.capabilityCode, "CAPABILITY");
  const level = safeSegment(context.levelCode, "LEVEL");
  const moduleNo =
    Number.isInteger(context.moduleNo) && context.moduleNo >= 0 ? context.moduleNo : 0;
  const base = `resources/capabilities/${capability}/levels/${level}/modules-${moduleNo}`;
  const category = context.category || "artifact";

  if (category === "content") return `${base}/content/${safeFilename(context)}`;

  if (category === "catalog")
    return `resources/catalog-assets/${capability}/${safeFilename(context)}`;

  const artifactType = safeSegment(context.artifactType || "artifact", "artifact");
  const artifactPath = `${base}/artifacts/${artifactType}`;
  return `${artifactPath}${context.artifactSubfolder ? `/${context.artifactSubfolder}` : ""}/${safeFilename(context)}`;
}

export class R2StorageService {
  constructor(private readonly bucket: R2BucketLike) {}

  /** The temporary object allows hashing during download before choosing the stable key. */
  async stageStream<T extends { contentHash: string; mimeType: string }>(
    download: (
      consume: (body: ReadableStream<Uint8Array>, mimeType: string) => Promise<void>,
    ) => Promise<T>,
    context: Omit<AssetKeyContext, "contentHash" | "mimeType"> & { uploadId: string },
  ): Promise<T & { key: string; publicUrl: string }> {
    const temporaryKey = `resources/.staging/${crypto.randomUUID()}`;
    try {
      const asset = await download(async (body, mimeType) => {
        await this.putStream(temporaryKey, body, {
          httpMetadata: { contentType: mimeType },
          customMetadata: { lifecycle: "temporary", uploadId: context.uploadId },
        });
      });
      const metadata = asset;
      const key = generateStableAssetKey({
        ...context,
        contentHash: metadata.contentHash,
        mimeType: metadata.mimeType,
      });
      // Each retry reads a fresh R2 stream; a failed upload cannot reuse a consumed body.
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const object = await this.bucket.get(temporaryKey);
          if (!object) throw new Error("Staged download is missing");
          await this.bucket.put(key, object.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: {
              originalUrl: context.originalUrl,
              uploadId: context.uploadId,
              uploadedAt: new Date().toISOString(),
              mimeType: metadata.mimeType,
              contentHash: metadata.contentHash,
              lifecycle: "staged",
            },
          });
          return {
            ...asset,
            key,
            publicUrl: `/api/admin/lte/assets?key=${encodeURIComponent(key)}`,
          };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    } finally {
      await this.bucket.delete(temporaryKey);
    }
  }

  private async putStream(
    key: string,
    body: ReadableStream<Uint8Array>,
    options: Record<string, unknown>,
  ): Promise<void> {
    if (!this.bucket.createMultipartUpload)
      throw new Error("R2 multipart storage is not configured");
    const upload = await this.bucket.createMultipartUpload(key, options);
    const reader = body.getReader();
    const partSize = 5 * 1024 * 1024;
    const parts: Array<{ partNumber: number; etag: string }> = [];
    let part = new Uint8Array(partSize);
    let used = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (let offset = 0; offset < value.length; ) {
          const length = Math.min(partSize - used, value.length - offset);
          part.set(value.subarray(offset, offset + length), used);
          used += length;
          offset += length;
          if (used === partSize) {
            parts.push(await upload.uploadPart(parts.length + 1, part));
            part = new Uint8Array(partSize);
            used = 0;
          }
        }
      }
      if (used) parts.push(await upload.uploadPart(parts.length + 1, part.subarray(0, used)));
      if (parts.length) await upload.complete(parts);
      else {
        await upload.abort();
        await this.bucket.put(key, new Uint8Array(), options);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      await upload.abort();
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  async uploadAsset(
    input: UploadAssetInput,
    maxAttempts = 3,
  ): Promise<{ key: string; publicUrl: string }> {
    const key = generateStableAssetKey(input);
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.bucket.put(key, input.bytes, {
          httpMetadata: { contentType: input.mimeType },
          customMetadata: {
            originalUrl: input.originalUrl,
            uploadedAt: new Date().toISOString(),
            uploadId: input.uploadId,
            mimeType: input.mimeType,
            contentHash: input.contentHash,
            lifecycle: "staged",
          },
        });
        return { key, publicUrl: `/api/admin/lte/assets?key=${encodeURIComponent(key)}` };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts)
          await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** (attempt - 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("R2 asset upload failed");
  }

  async activateAssets(keys: string[]): Promise<{ activated: number; failedKeys: string[] }> {
    let activated = 0;
    const failedKeys: string[] = [];
    for (let offset = 0; offset < keys.length; offset += 1000) {
      for (const key of [...new Set(keys.slice(offset, offset + 1000))]) {
        try {
          const object = await this.bucket.get(key);
          if (!object) throw new Error("Object not found");
          if (object.customMetadata?.["lifecycle"] === "active") continue;
          await this.bucket.put(key, object.body, {
            httpMetadata: object.httpMetadata,
            customMetadata: {
              ...(object.customMetadata || {}),
              lifecycle: "active",
              activatedAt: new Date().toISOString(),
            },
          });
          activated += 1;
        } catch {
          failedKeys.push(key);
        }
      }
    }
    return { activated, failedKeys };
  }

  async deleteStagedAssets(keys: string[]): Promise<{ deleted: number; failedKeys: string[] }> {
    const staged: string[] = [];
    const failedKeys: string[] = [];
    for (const key of [...new Set(keys)]) {
      try {
        const object = await this.bucket.head(key);
        if (!object) continue;
        if (object.customMetadata?.["lifecycle"] !== "active") staged.push(key);
      } catch {
        failedKeys.push(key);
      }
    }
    let deleted = 0;
    for (let offset = 0; offset < staged.length; offset += 1000) {
      const batch = staged.slice(offset, offset + 1000);
      try {
        await this.bucket.delete(batch);
        deleted += batch.length;
      } catch {
        failedKeys.push(...batch);
      }
    }
    return { deleted, failedKeys: [...new Set(failedKeys)] };
  }
}
