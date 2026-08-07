import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost as calculatePost } from "../calculate";
import { onRequestGet as readinessGet } from "../index";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

interface Chainable {
  select: (...args: unknown[]) => Chainable;
  eq: (...args: unknown[]) => Chainable;
  order: (...args: unknown[]) => Chainable;
  limit: (...args: unknown[]) => Chainable;
  in: (...args: unknown[]) => Chainable;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  update: (...args: unknown[]) => Chainable;
  then?: (onfulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
}

// biome-ignore lint/suspicious/noExplicitAny: mock chain factory
function chainable<T = any, E = any>(resolveVal: T = null as any, errorVal: E = null as any) {
  const chain: Chainable = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: vi
      .fn()
      .mockImplementation((onfulfilled) =>
        Promise.resolve({ data: resolveVal, error: errorVal }).then(onfulfilled),
      ),
  };
  return chain;
}

describe("Readiness API Endpoints", () => {
  const mockUser: AuthUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    org_id: "org-1",
    roles: ["learner"],
    products: ["lte"],
    membership_status: "active",
    is_email_verified: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/readiness/calculate", () => {
    it("returns 401 when requireAuth throws", async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
      const response = await calculatePost({
        request: new Request("http://localhost", { method: "POST" }),
        env: {} as LteEnv,
      } as PagesContext<LteEnv>);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    it("triggers calculation successfully", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return chainable({ id: "path-1", role_id: "role-1", role_readiness_percentage: 75 });
          }
          if (table === "user_capability_level_progress") {
            return chainable([{ level_id: "lvl-1" }]);
          }
          if (table === "modules") {
            return chainable([]);
          }
          if (table === "levels") {
            return chainable([{ total_xp: 100 }]);
          }
          if (table === "user_module_progress") {
            return chainable([]);
          }
          if (table === "xp_events") {
            return chainable([]);
          }
          if (table === "artifact_submissions") {
            return chainable([]);
          }
          if (table === "user_profiles") {
            return chainable({ bio: "", job_title: "", skills: [] });
          }
          return chainable();
        }),
      };
      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as SupabaseClient,
      );

      const response = await calculatePost({
        request: new Request("http://localhost", { method: "POST" }),
        env: {} as LteEnv,
      } as PagesContext<LteEnv>);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.readinessScore).toBeDefined();
      expect(body.band).toBeDefined();
    });
  });

  describe("GET /api/v1/readiness", () => {
    it("returns 401 when requireAuth throws", async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
      const response = await readinessGet({
        request: new Request("http://localhost"),
        env: {} as LteEnv,
      } as PagesContext<LteEnv>);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    it("constructs ReadinessDisplay payload successfully", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return chainable({
              id: "path-1",
              role_readiness_percentage: 75,
              updated_at: new Date().toISOString(),
              role_id: "role-1",
              roles: {
                role_name: "Frontend Engineer",
                role_family_name: "Eng",
                domain_name: "Frontend",
              },
            });
          }
          if (table === "user_capability_level_progress") {
            return chainable([{ level_id: "lvl-1" }]);
          }
          if (table === "modules") {
            return chainable([{ id: "mod-1", module_no: 1, level_id: "lvl-1" }]);
          }
          if (table === "levels") {
            return chainable([{ total_xp: 100 }]);
          }
          if (table === "user_module_progress") {
            return chainable([{ module_status: "mastered", module_id: "mod-1" }]);
          }
          if (table === "user_profiles") {
            return chainable({ bio: "Bio data", job_title: "Developer", skills: ["JS"] });
          }
          return chainable();
        }),
      };
      vi.mocked(createServiceSupabase).mockReturnValueOnce(
        mockSupabase as unknown as SupabaseClient,
      );

      const response = await readinessGet({
        request: new Request("http://localhost"),
        env: {} as LteEnv,
      } as PagesContext<LteEnv>);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.score).toBeDefined();
      expect(body.band).toBeDefined();
      expect(body.currentRole.name).toBe("Frontend Engineer");
      expect(body.components.courseCompletion.value).toBe(100);
      expect(body.components.profileCompletion.value).toBe(100);
    });
  });
});
