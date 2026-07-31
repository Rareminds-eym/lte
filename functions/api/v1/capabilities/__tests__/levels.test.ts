import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../[capabilityCode]/levels";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

interface Chainable extends Record<string, unknown> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function chainable(resolveVal: unknown = null, errorVal: unknown = null) {
  const chain: Chainable = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    in: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
  };
  return chain;
}

describe("GET /api/v1/capabilities/:capabilityCode/levels", () => {
  const mockUser = { sub: "user-uuid-1234", email: "learner@rareminds.com" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
      params: { capabilityCode: "TEST-CAP-101" },
    } as unknown as PagesContext<LteEnv>);
    expect(response.status).toBe(401);
  });

  it("returns 404 when capability is not in the user's role sequence", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser as never);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "learning_paths") {
          return chainable({ role_id: "role-1" });
        }
        return chainable([
          {
            id: "rcs-1",
            sequence_step: 1,
            required_level: "L3",
            capability_priority: "Core",
            capabilities: { id: "cap-1", code: "OTHER-CAP", name: "Other", description: "x" },
          },
        ]);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
      params: { capabilityCode: "TEST-CAP-101" },
    } as unknown as PagesContext<LteEnv>);
    expect(response.status).toBe(404);
  });

  it("returns levels ordered by level_no for the capability", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser as never);
    const eqArgs: Array<[string, unknown]> = [];
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "learning_paths") {
          return chainable({ role_id: "role-1" });
        }
        if (table === "role_capability_sequence") {
          return chainable([
            {
              id: "rcs-1",
              sequence_step: 1,
              required_level: "L3",
              capability_priority: "Core",
              capabilities: { id: "cap-1", code: "TEST-CAP-101", name: "Test", description: "x" },
            },
          ]);
        }
        const levelsData = [
          {
            id: "lvl-2",
            level_code: "TEST_L2_CL001",
            title: "Applied",
            description: "desc",
            example_outputs: ["Config Sheet"],
            duration_minutes: 360,
            difficulty_level: "foundation",
            status: "published",
            level_scale: { level_no: 2 },
          },
          {
            id: "lvl-1",
            level_code: "TEST_L1_CL001",
            title: "Guided",
            description: "desc",
            example_outputs: ["Worksheet"],
            duration_minutes: 360,
            difficulty_level: "beginner",
            status: "published",
            level_scale: { level_no: 1 },
          },
        ];
        let eqCalls = 0;
        const levelsChain: Chainable = {
          select: vi.fn().mockImplementation(() => levelsChain),
          eq: vi.fn().mockImplementation((col: string, val: unknown) => {
            eqCalls += 1;
            eqArgs.push([col, val]);
            return eqCalls < 3 ? levelsChain : { data: levelsData, error: null };
          }),
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return levelsChain;
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
      params: { capabilityCode: "TEST-CAP-101" },
    } as unknown as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.capability.code).toBe("TEST-CAP-101");
    expect(body.count).toBe(2);
    expect(body.levels[0].levelNumber).toBe(1);
    expect(body.levels[0].deliverables).toEqual(["Worksheet"]);
    expect(body.levels[1].levelNumber).toBe(2);
    expect(eqArgs).toEqual([
      ["capability_id", "cap-1"],
      ["is_active", true],
      ["status", "published"],
    ]);
  });
});
