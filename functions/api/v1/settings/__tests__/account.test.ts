import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../account";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

const mockUser: AuthUser = {
  sub: "user-uuid-1234",
  email: "learner@rareminds.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
};

interface UpdateChain extends Record<string, unknown> {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
}

function updateChain(resolveVal: unknown) {
  const chain: UpdateChain = {
    update: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) => Promise.resolve(resolveVal).then(resolve),
  };
  return chain;
}

function postContext(body: Record<string, unknown>) {
  return {
    request: new Request("http://localhost/api/v1/settings/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: {} as LteEnv,
  } as PagesContext<LteEnv>;
}

describe("POST /api/v1/settings/account", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestPost(postContext({ action: "deactivate" }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 403 when requireAuth throws FORBIDDEN", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));
    const response = await onRequestPost(postContext({ action: "deactivate" }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 for an invalid action", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const response = await onRequestPost(postContext({ action: "delete" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deactivates the account", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = updateChain({ data: null, error: null });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPost(postContext({ action: "deactivate" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("inactive");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "inactive", updated_at: expect.any(String) }),
    );
  });

  it("returns 500 when the update fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = updateChain({ data: null, error: new Error("db down") });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPost(postContext({ action: "deactivate" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).toBe("Internal server error");
  });

  it("does not leak internal error details on 500", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = updateChain({ data: null, error: "db down" });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPost(postContext({ action: "deactivate" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.message).not.toContain("db down");
  });
});
