import { expect, it } from "vitest";
import {
  certificateCleanupRequestSchema,
  certificateCursorSchema,
  internalQuerySchema,
} from "../certificateInternal";

const userId = "12345678-1234-4234-8234-123456789abc";
it("requires exactly one bounded, validated synchronization scope", () => {
  expect(internalQuerySchema.parse({ userId }).limit).toBe(100);
  for (const query of [
    {},
    { userId, updatedSince: "2026-10-09T00:00:00Z" },
    { userId, limit: 101 },
    { userId, cursor: "x".repeat(513) },
  ])
    expect(internalQuerySchema.safeParse(query).success).toBe(false);
});
it("validates opaque cursors and permits only empty maintenance inputs", () => {
  expect(certificateCursorSchema.parse({ id: userId, updatedAt: "2026-10-09T00:00:00Z" }).id).toBe(
    userId,
  );
  expect(certificateCursorSchema.safeParse({ id: "invalid", updatedAt: "invalid" }).success).toBe(
    false,
  );
  expect(certificateCleanupRequestSchema.parse({})).toEqual({});
  expect(certificateCleanupRequestSchema.safeParse({ prefix: "/" }).success).toBe(false);
});
