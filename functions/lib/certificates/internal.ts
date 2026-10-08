import { jsonResponse } from "@functions/lib/http";
import type { QueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import { credentialIdSchema } from "./credential-id";
import { certificateInternalReadPolicy } from "./queries";
import { verifyUrl } from "./template";
import type { CertificateRow } from "./types";
export const internalQuerySchema = z
  .object({
    userId: z.uuid().optional(),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict()
  .refine(
    (value) => Boolean(value.userId) !== Boolean(value.updatedSince),
    "Provide userId or updatedSince",
  );
const cursorSchema = z
  .object({ updatedAt: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();
const internalItemSchema = z.object({
  credentialId: credentialIdSchema,
  userId: z.uuid(),
  certificateType: z.enum(["course_completion", "role_readiness"]),
  title: z.string(),
  issuer: z.literal("Rareminds LTE"),
  level: z.string().nullable(),
  link: z.url(),
  issuedOn: z.iso.date(),
  description: z.string().nullable(),
  status: z.enum(["active", "revoked"]),
  platform: z.literal("LTE"),
  category: z.string(),
  documentUrl: z.string(),
  badge: z.string().nullable(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const internalResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ items: z.array(internalItemSchema), nextCursor: z.string().nullable() }),
});
export function internalError(
  code: string,
  message: string,
  status: number,
  requestId: string,
  headers?: HeadersInit,
) {
  return jsonResponse({ ok: false, error: { code, message }, requestId }, { status, headers });
}
export async function internalErrorResponse(response: Response): Promise<Response> {
  const body = (await response.json()) as {
    error?: { code?: string; message?: string };
    requestId?: string;
  };
  return internalError(
    body.error?.code ?? "CERTIFICATE_UNAVAILABLE",
    body.error?.message ?? "Certificate unavailable",
    response.status,
    body.requestId ?? crypto.randomUUID(),
    response.headers,
  );
}
export function internalItem(row: CertificateRow, env: LteEnv) {
  return {
    credentialId: row.credential_id,
    userId: row.user_id,
    certificateType: row.certificate_type,
    title: row.title,
    issuer: "Rareminds LTE",
    level: row.level_label,
    link: verifyUrl(env.CERTIFICATE_VERIFY_BASE_URL!, row.credential_id),
    issuedOn: row.issued_at?.slice(0, 10),
    description: row.subtitle,
    status: row.status === "revoked" ? "revoked" : "active",
    platform: "LTE",
    category: row.certificate_type,
    documentUrl: `/api/v1/internal/certificates/${row.credential_id}/pdf`,
    badge: row.badge,
    revokedAt: row.revoked_at,
    updatedAt: row.updated_at,
  };
}
export async function internalPage(qb: QueryGateway, query: z.infer<typeof internalQuerySchema>) {
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (query.cursor) {
    try {
      cursor = cursorSchema.parse(JSON.parse(atob(query.cursor)));
    } catch {
      throw new z.ZodError([{ code: "custom", path: ["cursor"], message: "Invalid cursor" }]);
    }
    if (query.updatedSince && Date.parse(cursor.updatedAt) < Date.parse(query.updatedSince))
      throw new z.ZodError([
        { code: "custom", path: ["cursor"], message: "Cursor precedes updatedSince" },
      ]);
  }
  const filters = [
    { column: "status", op: "in" as const, value: ["issued", "revoked"] },
    ...(query.userId ? [{ column: "user_id", op: "eq" as const, value: query.userId }] : []),
    ...(query.updatedSince
      ? [{ column: "updated_at", op: "gte" as const, value: query.updatedSince }]
      : []),
  ];
  const sort = [
    { column: "updated_at", ascending: true },
    { column: "id", ascending: true },
  ];
  // Two disjoint reads implement lexicographic (updated_at, id) > cursor without raw PostgREST OR strings.
  const same = cursor
    ? await qb.read<CertificateRow[]>(certificateInternalReadPolicy, {
        filters: [
          ...filters,
          { column: "updated_at", op: "eq", value: cursor.updatedAt },
          { column: "id", op: "gt", value: cursor.id },
        ],
        sort,
        limit: query.limit,
      })
    : [];
  const later =
    same.length < query.limit
      ? await qb.read<CertificateRow[]>(certificateInternalReadPolicy, {
          filters: [
            ...filters,
            ...(cursor
              ? [{ column: "updated_at", op: "gt" as const, value: cursor.updatedAt }]
              : []),
          ],
          sort,
          limit: query.limit - same.length,
        })
      : [];
  const rows = [...same, ...later];
  const last = rows.at(-1);
  // A full last page intentionally emits a cursor; its following empty page terminates the pull.
  return {
    rows,
    nextCursor:
      rows.length === query.limit && last
        ? btoa(JSON.stringify({ updatedAt: last.updated_at, id: last.id }))
        : null,
  };
}
