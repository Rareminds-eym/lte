import { REVIEW_CRITERIA } from "@functions/lib/human-review/contracts";
import { ReviewError } from "@functions/lib/human-review/service";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../[[path]]";

const rpc = vi.fn();
const read = vi.fn();
const upsert = vi.fn();
vi.mock("@functions/lib/query-gateway", () => ({
  createServiceQueryGateway: () => ({ rpc, read, upsert }),
}));
vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));

const identity = vi.fn();
const memberships = vi.fn();
vi.mock("@functions/middleware", () => ({
  getAuthUser: () => ({ sub: "00000000-0000-4000-8000-000000000001" }),
  rateLimiter: { check: () => ({ allowed: true, retryAfterMs: 0 }) },
  rateLimitErrorResponse: (_id: string, _ms: number) =>
    new Response(JSON.stringify({ code: "RATE_LIMITED" }), { status: 429 }),
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const makeAssignment = (overrides = {}) => ({
  id: id(1),
  submission_id: id(2),
  learner_id: id(3),
  reviewer_id: id(1),
  scope_id: id(5),
  scope_type: "school_class",
  status: "pending",
  version: 2,
  rubric_snapshot: { version: 1, criteria: [...REVIEW_CRITERIA] },
  required_at: new Date().toISOString(),
  due_by: new Date().toISOString(),
  started_at: null,
  completed_at: null,
  ...overrides,
});

const makeContext = (url: string, method = "GET", body?: unknown) => {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return {
    request: new Request(`https://test.io${url}`, init),
    env: {
      HUMAN_REVIEW_AVAILABLE: "true",
      HUMAN_REVIEW_ENABLED: "true",
      SSO_SERVICE: { getUserById: identity, getUserMemberships: memberships },
      STORAGE_BUCKET: { get: vi.fn() },
    },
  } as unknown as PagesContext<LteEnv>;
};

describe("reviews/[[path]].ts handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.mockResolvedValue({
      email: "reviewer@test.io",
      is_blocked: false,
      is_email_verified: true,
    });
    memberships.mockResolvedValue({
      memberships: [{ status: "active", org_id: id(6), role: "educator" }],
    });
  });

  describe("error handling", () => {
    it("returns 404 for unmatched routes", async () => {
      // Mock requireAssignment to succeed so we get past auth
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue({
        scopeId: id(5),
        scopeType: "school_class",
        organizationId: id(6),
        enabled: true,
        slaDays: 3,
        timeZone: "Asia/Kolkata",
        loadCap: 10,
        threshold: 60,
        reviewerIds: [id(1)],
      });
      read.mockResolvedValue(makeAssignment());

      const ctx = makeContext(`/api/v1/reviews/${id(1)}/unknown-action`, "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(404);
    });

    it("returns 400 for ZodError (invalid UUID path)", async () => {
      const ctx = makeContext("/api/v1/reviews/not-a-uuid", "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns ReviewError status codes", async () => {
      read.mockRejectedValue(new ReviewError("not found", 404, "REVIEW_NOT_FOUND"));
      const ctx = makeContext(`/api/v1/reviews/${id(1)}`, "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(404);
    });

    it("returns 503 for unexpected errors", async () => {
      read.mockRejectedValue(new Error("DB crash"));
      const ctx = makeContext(`/api/v1/reviews/${id(1)}`, "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("REVIEW_UNAVAILABLE");
    });
  });

  describe("queue / stats", () => {
    it("returns queue items for GET /reviews/queue", async () => {
      const items = [makeAssignment()];
      rpc.mockResolvedValue(items);
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue({
        scopeId: id(5),
        scopeType: "school_class",
        organizationId: id(6),
        enabled: true,
        slaDays: 3,
        timeZone: "Asia/Kolkata",
        loadCap: 10,
        threshold: 60,
        reviewerIds: [id(1)],
      });

      const ctx = makeContext("/api/v1/reviews/queue", "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; items: unknown[] };
      expect(body.success).toBe(true);
    });

    it("returns stats for GET /reviews/stats", async () => {
      const items = [
        makeAssignment({ status: "pending" }),
        makeAssignment({ id: id(2), status: "in_progress" }),
      ];
      read.mockResolvedValue(items);
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue({
        scopeId: id(5),
        scopeType: "school_class",
        organizationId: id(6),
        enabled: true,
        slaDays: 3,
        timeZone: "Asia/Kolkata",
        loadCap: 10,
        threshold: 60,
        reviewerIds: [id(1)],
      });

      const ctx = makeContext("/api/v1/reviews/stats", "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { pending: number; inProgress: number };
      expect(body.pending).toBeGreaterThanOrEqual(0);
    });

    it("rejects invalid cursor", async () => {
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue(null);
      identity.mockResolvedValue({
        email: "r@test.io",
        is_blocked: false,
        is_email_verified: true,
      });
      memberships.mockResolvedValue({
        memberships: [{ status: "active", org_id: id(6), role: "educator" }],
      });

      const ctx = makeContext(`/api/v1/reviews/queue?cursor=${btoa("{bad json}")}`, "GET");
      const response = await onRequest(ctx);
      expect(response.status).toBe(400);
    });
  });

  describe("start / complete / return", () => {
    it("starts a review with POST /reviews/:id/start", async () => {
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue({
        scopeId: id(5),
        scopeType: "school_class",
        organizationId: id(6),
        enabled: true,
        slaDays: 3,
        timeZone: "Asia/Kolkata",
        loadCap: 10,
        threshold: 60,
        reviewerIds: [id(1)],
      });
      read.mockResolvedValue(makeAssignment());
      rpc.mockResolvedValue(
        makeAssignment({ status: "in_progress", started_at: new Date().toISOString() }),
      );

      const ctx = makeContext(`/api/v1/reviews/${id(1)}/start`, "POST", {
        expectedVersion: 2,
      });
      const response = await onRequest(ctx);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("rejects return with non-revision decision", async () => {
      const { callSkill } = await import("@functions/lib/skill-gateway");
      vi.mocked(callSkill).mockResolvedValue({
        scopeId: id(5),
        scopeType: "school_class",
        organizationId: id(6),
        enabled: true,
        slaDays: 3,
        timeZone: "Asia/Kolkata",
        loadCap: 10,
        threshold: 60,
        reviewerIds: [id(1)],
      });
      read.mockResolvedValue(makeAssignment());

      const ctx = makeContext(`/api/v1/reviews/${id(1)}/return`, "POST", {
        expectedVersion: 2,
        decision: "pass",
        scores: REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, score: 3 })),
        feedback: "Great work",
        evidenceSummary: "Good evidence",
      });
      ctx.request = new Request(ctx.request.url, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 2,
          decision: "pass",
          scores: REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, score: 3 })),
          feedback: "Great work",
          evidenceSummary: "Good evidence",
        }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": "test-key-123" },
      });
      const response = await onRequest(ctx);
      expect(response.status).toBe(400);
    });
  });
});
