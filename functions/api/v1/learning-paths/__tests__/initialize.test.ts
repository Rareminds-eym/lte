import { requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../initialize";

vi.mock("@functions/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(),
}));

interface MockQueryChain {
  select: () => MockQueryChain;
  update: (payload?: unknown) => MockQueryChain;
  insert: () => MockQueryChain;
  eq: (col: string, val: unknown) => MockQueryChain;
  neq?: (col: string, val: unknown) => MockQueryChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
}

function createMockQueryChain(resolveVal: unknown, errorVal: unknown = null): MockQueryChain {
  const chain: MockQueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
  };
  return chain;
}

describe("POST /api/v1/learning-paths/initialize", () => {
  const mockUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    products: ["lte"],
    roles: ["learner"],
  };

  const validPayload = {
    fit: "High",
    track: "Software Engineering",
    matchScore: 92,
    whyItFits: "Strong analytical skills",
    attemptId: "11111111-1111-4111-a111-111111111111",
    roleId: "22222222-2222-4222-b222-222222222222",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 401 when requireAuth throws an authentication error", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Missing bearer token"));

    const request = new Request("http://localhost/api/v1/learning-paths/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const context = { request, env: {} as LteEnv } as unknown as PagesContext<LteEnv>;
    const response = await onRequestPost(context);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toContain("Missing bearer token");
  });

  it("should return 400 when request payload validation fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
    );

    const invalidPayload = {
      fit: "InvalidFitClass", // Should fail enum validation
      track: "", // Should fail empty check
      matchScore: 150, // Should fail max constraint
      attemptId: "not-a-uuid", // Should fail UUID validation
    };

    const request = new Request("http://localhost/api/v1/learning-paths/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const context = { request, env: {} as LteEnv } as unknown as PagesContext<LteEnv>;
    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when the target roleId is missing from the shadow roles table", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
    );

    // Mock role not found
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "roles") {
          return createMockQueryChain(null); // Return null to indicate role does not exist
        }
        return createMockQueryChain({});
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
    );

    const request = new Request("http://localhost/api/v1/learning-paths/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const context = { request, env: {} as LteEnv } as unknown as PagesContext<LteEnv>;
    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("ROLE_NOT_FOUND");
    expect(body.error.message).toContain("does not exist in local database");
  });

  it("should successfully insert new track and path and deactivate others if they do not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
    );

    // Track state to make sure queries were hit correctly
    let updateDeactivateCalled = false;
    let trackInsertCalled = false;
    let pathInsertCalled = false;

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "roles") {
          return createMockQueryChain({ id: validPayload.roleId });
        }
        if (table === "learning_tracks") {
          const chain = createMockQueryChain(null); // Track does not exist yet (return null)
          chain.insert = vi.fn().mockImplementation(() => {
            trackInsertCalled = true;
            return createMockQueryChain({ id: "new-track-uuid" });
          });
          return chain;
        }
        if (table === "learning_paths") {
          const chain = createMockQueryChain(null); // Path does not exist yet
          chain.update = vi.fn().mockImplementation((payload) => {
            if (payload.is_active === false) {
              updateDeactivateCalled = true;
            }
            return createMockQueryChain({});
          });
          chain.insert = vi.fn().mockImplementation(() => {
            pathInsertCalled = true;
            return createMockQueryChain({ id: "new-path-uuid" });
          });
          return chain;
        }
        return createMockQueryChain(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
    );

    const request = new Request("http://localhost/api/v1/learning-paths/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const context = { request, env: {} as LteEnv } as unknown as PagesContext<LteEnv>;
    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.learningTrackId).toBe("new-track-uuid");
    expect(body.learningPathId).toBe("new-path-uuid");

    expect(trackInsertCalled).toBe(true);
    expect(updateDeactivateCalled).toBe(true);
    expect(pathInsertCalled).toBe(true);
  });

  it("should successfully update track and path and deactivate others if they already exist", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      mockUser as unknown as Awaited<ReturnType<typeof requireAuth>>,
    );

    let trackUpdateCalled = false;
    let pathUpdateCalled = false;

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "roles") {
          return createMockQueryChain({ id: validPayload.roleId });
        }
        if (table === "learning_tracks") {
          const chain = createMockQueryChain({ id: "existing-track-uuid" }); // Track exists
          chain.update = vi.fn().mockImplementation(() => {
            trackUpdateCalled = true;
            return createMockQueryChain({ id: "existing-track-uuid" });
          });
          return chain;
        }
        if (table === "learning_paths") {
          const chain = createMockQueryChain({ id: "existing-path-uuid" }); // Path exists
          chain.update = vi.fn().mockImplementation((payload) => {
            if (payload.is_active === true) {
              pathUpdateCalled = true;
            }
            return createMockQueryChain({ id: "existing-path-uuid" });
          });
          return chain;
        }
        return createMockQueryChain(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(
      mockSupabase as unknown as ReturnType<typeof createServiceSupabase>,
    );

    const request = new Request("http://localhost/api/v1/learning-paths/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const context = { request, env: {} as LteEnv } as unknown as PagesContext<LteEnv>;
    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.learningTrackId).toBe("existing-track-uuid");
    expect(body.learningPathId).toBe("existing-path-uuid");

    expect(trackUpdateCalled).toBe(true);
    expect(pathUpdateCalled).toBe(true);
  });
});
