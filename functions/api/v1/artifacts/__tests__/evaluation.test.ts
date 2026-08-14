import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactSubmissionError } from "../queries";
import { onRequestGet } from "../submissions/[id]/evaluation";

const { getSubmissionEvaluationFlowMock } = vi.hoisted(() => ({
  getSubmissionEvaluationFlowMock: vi.fn(),
}));

vi.mock("../queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../queries")>();
  return { ...actual, getSubmissionEvaluationFlow: getSubmissionEvaluationFlowMock };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";

const flow = {
  id: "flow-1",
  submission_id: SUBMISSION_ID,
  stage: "final",
  status: "completed",
  score: 85,
  decision: "pass",
  feedback: "Great work.",
  improvements: "Add references.",
  completed_at: "2026-08-06T00:00:00.000Z",
  metadata: {
    confidence: 0.95,
    rubric_rows: [{ criterion: "Completeness", score: 1 }],
    calculated_xp: 120,
    debug_telemetry: { provider: "openrouter" },
  },
};

function createContext(
  params: Record<string, string>,
  user: { sub: string } | null = { sub: "user-1" },
): PagesContext<LteEnv> {
  return {
    request: new Request(
      `http://localhost/api/v1/artifacts/submissions/${SUBMISSION_ID}/evaluation`,
    ),
    env: {} as LteEnv,
    params,
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn(),
    data: user ? { user } : {},
  };
}

describe("GET /api/v1/artifacts/submissions/[id]/evaluation", () => {
  const mockSupabase = { from: vi.fn() } as unknown as SupabaseClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.mocked(createServiceSupabase).mockReturnValue(mockSupabase);
  });

  it("returns 400 when the submission id route param is missing", async () => {
    const response = await onRequestGet(createContext({}));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SUBMISSION_ID");
    expect(getSubmissionEvaluationFlowMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the submission id is not a UUID", async () => {
    const response = await onRequestGet(createContext({ id: "not-a-uuid" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SUBMISSION_ID");
    expect(getSubmissionEvaluationFlowMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not on the context", async () => {
    const response = await onRequestGet(createContext({ id: SUBMISSION_ID }, null));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the mapped evaluation payload for a completed flow", async () => {
    getSubmissionEvaluationFlowMock.mockResolvedValue(flow);

    const response = await onRequestGet(createContext({ id: SUBMISSION_ID }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      success: boolean;
      evaluation: Record<string, unknown>;
    };
    expect(body.success).toBe(true);
    expect(body.evaluation).toEqual({
      id: "flow-1",
      submission_id: SUBMISSION_ID,
      stage: "final",
      status: "completed",
      score: 85,
      confidence: 0.95,
      decision: "pass",
      feedback: "Great work.",
      improvements: "Add references.",
      completed_at: "2026-08-06T00:00:00.000Z",
      rubric_rows: [{ criterion: "Completeness", score: 1 }],
      calculated_xp: 120,
      debug_telemetry: { provider: "openrouter" },
    });
    expect(getSubmissionEvaluationFlowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        read: expect.any(Function),
        insert: expect.any(Function),
        update: expect.any(Function),
        upsert: expect.any(Function),
        delete: expect.any(Function),
        rpc: expect.any(Function),
      }),
      SUBMISSION_ID,
      "user-1",
    );
  });

  it("returns evaluation null when no flow exists", async () => {
    getSubmissionEvaluationFlowMock.mockResolvedValue(null);

    const response = await onRequestGet(createContext({ id: SUBMISSION_ID }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { success: boolean; evaluation: unknown };
    expect(body.success).toBe(true);
    expect(body.evaluation).toBeNull();
  });

  it("returns 404 when the submission is not found", async () => {
    getSubmissionEvaluationFlowMock.mockRejectedValue(
      new ArtifactSubmissionError("Submission not found.", 404, "SUBMISSION_NOT_FOUND"),
    );

    const response = await onRequestGet(createContext({ id: SUBMISSION_ID }));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SUBMISSION_NOT_FOUND");
  });

  it("returns 500 on an unexpected error", async () => {
    getSubmissionEvaluationFlowMock.mockRejectedValue(new Error("db down"));

    const response = await onRequestGet(createContext({ id: SUBMISSION_ID }));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVER_ERROR");
  });
});
