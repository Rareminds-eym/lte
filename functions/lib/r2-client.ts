import type { LteEnv } from "./types";

export interface CreateObjectKeyParams {
  namespace: string;
  ownerId?: string;
  entityId?: string;
  recordId?: string;
  fileId?: string;
  fileName?: string;
}

export interface R2ObjectMetadata {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date;
  contentType?: string;
}

type R2ObjectBody = ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null;

const DEFAULT_OBJECT_NAME = "file";

export function sanitizeObjectName(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  const sanitized = text.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || DEFAULT_OBJECT_NAME;
}

export function createObjectKey(params: CreateObjectKeyParams): string {
  const namespaceSegments = params.namespace
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizeObjectName(segment));
  const segments = [
    ...namespaceSegments,
    ...(params.ownerId ? ["users", sanitizeObjectName(params.ownerId)] : []),
    ...(params.entityId ? [sanitizeObjectName(params.entityId)] : []),
    ...(params.recordId ? [sanitizeObjectName(params.recordId)] : []),
  ];

  if (params.fileName || params.fileId) {
    const safeFileName = sanitizeObjectName(params.fileName);
    segments.push(
      params.fileId ? `${sanitizeObjectName(params.fileId)}-${safeFileName}` : safeFileName,
    );
  }

  return segments.join("/");
}

export async function putObject(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  key: string,
  body: R2ObjectBody,
  options?: { contentType?: string; contentDisposition?: string },
): Promise<unknown> {
  return env.STORAGE_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: options?.contentType,
      contentDisposition: options?.contentDisposition,
    },
  });
}

export async function getObject(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  key: string,
): Promise<unknown> {
  return env.STORAGE_BUCKET.get(key);
}

export async function headObject(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  key: string,
): Promise<R2ObjectMetadata | null> {
  const object = (await env.STORAGE_BUCKET.head(key)) as {
    key?: string;
    size?: number;
    etag?: string;
    httpEtag?: string;
    uploaded?: Date;
    httpMetadata?: { contentType?: string };
  } | null;

  if (!object) return null;

  return {
    key: object.key ?? key,
    size: object.size ?? 0,
    etag: object.httpEtag ?? object.etag,
    uploaded: object.uploaded,
    contentType: object.httpMetadata?.contentType,
  };
}

export async function deleteObject(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  key: string,
): Promise<void> {
  await env.STORAGE_BUCKET.delete(key);
}

export async function objectExists(
  env: Pick<LteEnv, "STORAGE_BUCKET">,
  key: string,
): Promise<boolean> {
  return (await headObject(env, key)) !== null;
}
