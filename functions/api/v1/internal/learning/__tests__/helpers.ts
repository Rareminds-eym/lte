import type { PagesContext } from "@functions/lib/types";
import type { learningSnapshotSchema } from "@functions/schemas/learning";
import type { z } from "zod";
export const levelId = "10000000-0000-4000-8000-000000000001";
export const secret = "x".repeat(32);
export function snapshot(): z.infer<typeof learningSnapshotSchema> {
  return {
    schemaVersion: 1,
    evaluationPolicy: "human",
    revision: "b".repeat(32),
    levels: [
      {
        levelId,
        capabilityId: "20000000-0000-4000-8000-000000000001",
        capabilityName: "Frontend",
        title: "Frontend L2",
        code: "L2",
        levelNumber: 2,
        version: 1,
        fingerprint: "a".repeat(32),
        approved: false,
        evidence: [],
      },
    ],
  };
}
export async function signedContext(
  operation: string,
  body: unknown = {},
  raw?: string,
): Promise<PagesContext> {
  const bytes = raw ?? JSON.stringify(body),
    timestamp = String(Date.now()),
    path = `/api/v1/internal/learning/${operation}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`POST\n${path}\n${timestamp}\n${bytes}`),
  );
  return {
    env: { LTE_CATALOG_SYNC_SECRET: secret } as PagesContext["env"],
    params: {},
    data: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
    request: new Request(`https://lte.invalid${path}`, {
      method: "POST",
      body: bytes,
      headers: {
        "x-lte-timestamp": timestamp,
        "x-lte-signature": [...new Uint8Array(signature)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        "X-Request-Id": "30000000-0000-4000-8000-000000000001",
        traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
      },
    }),
  };
}
