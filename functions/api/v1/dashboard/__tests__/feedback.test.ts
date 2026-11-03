import { createQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../feedback";

const read = vi.fn();
vi.mock("@functions/lib/query-gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@functions/lib/query-gateway")>()),
  createServiceQueryGateway: () => ({ read }),
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const mockAuth = vi.fn();
vi.mock("@functions/middleware", () => ({
  requireAuth: (...args: unknown[]) => mockAuth(...args),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

const makeContext = (overrides: Partial<LteEnv> = {}) =>
  ({
    request: new Request("https://test.io/api/v1/dashboard/feedback"),
    env: { ...overrides },
  }) as unknown as PagesContext<LteEnv>;

describe("dashboard/feedback.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ sub: id(1) });
  });

  it("returns empty arrays when no reviews exist", async () => {
    read.mockResolvedValue([]);
    const response = await onRequestGet(makeContext());
    const body = (await response.json()) as Record<string, unknown>;
    expect(body["success"]).toBe(true);
    expect(body["upcoming"]).toEqual([]);
    expect(body["recentFeedback"]).toEqual([]);
  });

  it("returns 401 when auth fails", async () => {
    const { AuthError } = await import("@functions/middleware");
    mockAuth.mockRejectedValue(new AuthError("Not authorized", "UNAUTHORIZED"));
    const response = await onRequestGet(makeContext());
    expect(response.status).toBe(401);
  });

  it("returns 503 on unexpected errors", async () => {
    read.mockRejectedValue(new Error("database down"));
    const response = await onRequestGet(makeContext());
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FEEDBACK_UNAVAILABLE");
  });

  it("builds upcoming and recentFeedback when reviews exist", async () => {
    const now = new Date().toISOString();
    const pendingReview = {
      id: id(10),
      submission_id: id(20),
      learner_id: id(1),
      reviewer_id: id(4),
      scope_id: id(5),
      scope_type: "school_class",
      status: "pending",
      version: 1,
      rubric_snapshot: { version: 1, criteria: [] },
      required_at: now,
      due_by: now,
      started_at: null,
      completed_at: null,
    };
    const completedReview = {
      ...pendingReview,
      id: id(11),
      submission_id: id(21),
      status: "completed",
      completed_at: now,
    };

    const results = [
      [pendingReview],
      [completedReview],
      [
        { id: id(20), user_module_progress_id: id(30) },
        { id: id(21), user_module_progress_id: id(31) },
      ],
      [
        { id: id(30), module_id: id(40) },
        { id: id(31), module_id: id(41) },
      ],
      [
        { id: id(40), level_id: id(50), module_no: 1, title: "Module A" },
        { id: id(41), level_id: id(51), module_no: 2, title: "Module B" },
      ],
    ];
    const chains = results.map((data) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        range: vi.fn(() => chain),
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable.
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return chain;
    });
    let queryIndex = 0;
    const from = vi.fn((_table: string) => chains[queryIndex++]);
    const gateway = createQueryGateway({ from } as unknown as SupabaseClient);
    read.mockImplementation(gateway.read);

    const response = await onRequestGet(makeContext());
    expect(response.status).toBe(200);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "review_assignments",
      "review_assignments",
      "artifact_submissions",
      "user_module_progress",
      "modules",
    ]);
    chains.slice(0, 4).forEach((chain, index) => {
      expect(chain.eq).toHaveBeenCalledWith(index < 2 ? "learner_id" : "user_id", id(1));
    });
    const body = (await response.json()) as {
      upcoming: Array<{ title: string; type: string }>;
      recentFeedback: Array<{ title: string; type: string }>;
    };
    expect(body.upcoming).toHaveLength(1);
    const firstUpcoming = body.upcoming[0];
    if (firstUpcoming) {
      expect(firstUpcoming.title).toBe("Module A");
      expect(firstUpcoming.type).toBe("staff-review");
    }
    expect(body.recentFeedback).toHaveLength(1);
    const firstRecent = body.recentFeedback[0];
    if (firstRecent) {
      expect(firstRecent.title).toBe("Module B");
      expect(firstRecent.type).toBe("staff-review");
    }
  });
});
