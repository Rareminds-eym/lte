import { describe, expect, it, vi } from "vitest";
import {
  createObjectKey,
  deleteObject,
  headObject,
  objectExists,
  putObject,
  sanitizeObjectName,
} from "../r2-client";
import type { LteEnv } from "../types";

const createEnv = (headResult: unknown = null): Pick<LteEnv, "STORAGE_BUCKET"> => ({
  STORAGE_BUCKET: {
    put: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(null),
    head: vi.fn().mockResolvedValue(headResult),
    delete: vi.fn().mockResolvedValue(undefined),
  },
});

describe("sanitizeObjectName", () => {
  it("keeps safe object name characters", () => {
    expect(sanitizeObjectName("Report_1-final.xlsx")).toBe("Report_1-final.xlsx");
  });

  it("replaces unsafe characters and trims separators", () => {
    expect(sanitizeObjectName("  Module 0 / readiness sheet.xlsx  ")).toBe(
      "Module-0-readiness-sheet.xlsx",
    );
  });

  it("falls back when the name has no safe characters", () => {
    expect(sanitizeObjectName("///")).toBe("file");
  });
});

describe("createObjectKey", () => {
  it("builds a reusable user-scoped object key", () => {
    expect(
      createObjectKey({
        namespace: "submissions/artifacts",
        ownerId: "user 1",
        entityId: "artifact/1",
        recordId: "submission 1",
        fileId: "file 1",
        fileName: "Readiness Sheet.xlsx",
      }),
    ).toBe(
      "submissions/artifacts/users/user-1/artifact-1/submission-1/file-1-Readiness-Sheet.xlsx",
    );
  });
});

describe("R2 object helpers", () => {
  it("passes content metadata on put", async () => {
    const env = createEnv();

    await putObject(env, "tmp/file.txt", "hello", { contentType: "text/plain" });

    expect(env.STORAGE_BUCKET.put).toHaveBeenCalledWith("tmp/file.txt", "hello", {
      httpMetadata: {
        contentType: "text/plain",
        contentDisposition: undefined,
      },
    });
  });

  it("normalizes head metadata", async () => {
    const uploaded = new Date("2026-08-05T00:00:00.000Z");
    const env = createEnv({
      key: "tmp/file.txt",
      size: 5,
      httpEtag: "etag",
      uploaded,
      httpMetadata: { contentType: "text/plain" },
    });

    await expect(headObject(env, "tmp/file.txt")).resolves.toEqual({
      key: "tmp/file.txt",
      size: 5,
      etag: "etag",
      uploaded,
      contentType: "text/plain",
    });
  });

  it("checks existence through head", async () => {
    await expect(objectExists(createEnv(null), "missing")).resolves.toBe(false);
    await expect(objectExists(createEnv({ size: 1 }), "present")).resolves.toBe(true);
  });

  it("deletes by key", async () => {
    const env = createEnv();

    await deleteObject(env, "tmp/file.txt");

    expect(env.STORAGE_BUCKET.delete).toHaveBeenCalledWith("tmp/file.txt");
  });
});
