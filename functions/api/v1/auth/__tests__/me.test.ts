import { createQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../me";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/query-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/query-gateway")>();
  return { ...actual, createServiceQueryGateway: vi.fn() };
});

const mockUser: AuthUser = {
  sub: "u-1",
  email: "a@b.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
  user_metadata: {},
};

function stubDb(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  vi.mocked(createServiceQueryGateway).mockReturnValueOnce(
    createQueryGateway({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient),
  );
  return chain;
}

function ctx() {
  return {
    request: new Request("http://localhost/api/v1/auth/me"),
    env: { SUPABASE_URL: "x", SUPABASE_SERVICE_ROLE_KEY: "x" } as LteEnv,
  } as PagesContext<LteEnv>;
}

describe("GET /api/v1/auth/me — account status gate", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns user for active accounts", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    stubDb({ id: "u-1", status: "active" });
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("u-1");
  });

  it("auto-reactivates inactive accounts and returns 200", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = stubDb({ id: "u-1", status: "inactive" });
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("returns 403 for suspended accounts", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    stubDb({ id: "u-1", status: "suspended" });
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(403);
  });

  it("returns 403 for deleted accounts", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    stubDb({ id: "u-1", status: "deleted" });
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(403);
  });

  it("returns 401 when user record is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    stubDb(null);
    const res = await onRequestGet(ctx());
    expect(res.status).toBe(401);
  });
});
