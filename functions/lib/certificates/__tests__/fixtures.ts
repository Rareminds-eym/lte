import type { QueryGateway } from "@functions/lib/query-gateway";
import { vi } from "vitest";
import type { CertificateRow } from "../types";
export const userId = "11111111-1111-4111-8111-111111111111";
export const levelId = "22222222-2222-4222-8222-222222222222";
export const pathId = "33333333-3333-4333-8333-333333333333";
export const row: CertificateRow = {
  supersedes_id: null,
  id: "44444444-4444-4444-8444-444444444444",
  credential_id: "LTE-0123456789ABCDEF",
  user_id: userId,
  certificate_type: "course_completion",
  status: "issued",
  level_id: levelId,
  role_id: null,
  learning_path_id: pathId,
  level_progress_id: "55555555-5555-4555-8555-555555555555",
  learner_name: "Ada Lovelace",
  title: "Applied problem solving",
  subtitle: "Problem solving",
  level_label: "Level 1",
  badge: "skilled",
  completion_date: "2026-10-08T00:00:00.000Z",
  metadata: {},
  issued_at: "2026-10-08T00:00:00.000Z",
  pdf_object_key: null,
  pdf_template_version: null,
  pdf_generated_at: null,
  revoked_at: null,
  revoked_reason: null,
  revoked_by: null,
  created_at: "2026-10-08T00:00:00.000Z",
  updated_at: "2026-10-08T00:00:00.000Z",
};
export function gateway() {
  const read = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const qb = {
    read,
    insert,
    update,
    upsert: vi.fn(),
    delete: vi.fn(),
    rpc: vi.fn(),
  } as unknown as QueryGateway;
  return { qb, read, insert, update };
}
export const env = {
  CF_ACCOUNT_ID: "a".repeat(32),
  BROWSER_RENDERING_API_TOKEN: "private-test-render-token",
  CERTIFICATE_VERIFY_BASE_URL: "https://skillpassport.rareminds.in/verify",
  SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.rareminds.in",
  SKILLPASSPORT_INTERNAL_SECRET: "test-internal-secret-at-least-32-characters",
};
