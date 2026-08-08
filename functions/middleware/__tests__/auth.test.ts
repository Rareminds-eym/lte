import type { LteEnv } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import { initAuth, verifyJWT } from "@rareminds-eym/auth-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractBearerToken, requireAuth, toAuthApiUser } from "../auth";

vi.mock("@rareminds-eym/auth-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rareminds-eym/auth-core")>();
  return { ...actual, initAuth: vi.fn(), verifyJWT: vi.fn() };
});

const mockUser: AuthUser = {
  sub: "user-uuid-1234",
  email: "learner@rareminds.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
};

const mockEnv: LteEnv = {
  ASSETS: { fetch: async () => new Response() },
  SSO_SERVICE: {} as LteEnv["SSO_SERVICE"],
  STORAGE_BUCKET: {
    put: () => Promise.resolve({}),
    get: () => Promise.resolve(null),
    head: () => Promise.resolve(null),
    delete: () => Promise.resolve(undefined),
  },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.example.com",
  SKILLPASSPORT_INTERNAL_SECRET: "a-secret-that-is-at-least-32-characters-long",
};

describe("extractBearerToken", () => {
  it("returns null when the Authorization header is missing", () => {
    expect(extractBearerToken(new Request("http://localhost"))).toBeNull();
  });

  it("returns null when the header is not Bearer", () => {
    const request = new Request("http://localhost", { headers: { authorization: "Basic abc" } });
    expect(extractBearerToken(request)).toBeNull();
  });

  it("returns the token for a Bearer header", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    expect(extractBearerToken(request)).toBe("token-123");
  });

  it("returns null when only the Bearer prefix is present", () => {
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer   " },
    });
    expect(extractBearerToken(request)).toBeNull();
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(initAuth).mockImplementation(() => undefined);
  });

  it("throws UNAUTHORIZED when no token is present", async () => {
    await expect(requireAuth(new Request("http://localhost"), mockEnv)).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHORIZED",
    });
  });

  it("returns the user when the token is valid and lte is a product", async () => {
    vi.mocked(verifyJWT).mockResolvedValueOnce(mockUser);
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).resolves.toEqual(mockUser);
  });

  it("maps token verification failures to UNAUTHORIZED AuthError", async () => {
    vi.mocked(verifyJWT).mockRejectedValueOnce(new Error("signature verification failed"));
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHORIZED",
    });
  });

  it("throws FORBIDDEN when the user lacks the lte product", async () => {
    vi.mocked(verifyJWT).mockResolvedValueOnce({ ...mockUser, products: ["other"] });
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("fails fast with a config error when SSO_SERVICE binding is missing", async () => {
    const envWithoutSso: LteEnv = {
      ...mockEnv,
      SSO_SERVICE: undefined as unknown as LteEnv["SSO_SERVICE"],
    };
    await expect(requireAuth(new Request("http://localhost"), envWithoutSso)).rejects.toThrow(
      /SSO_SERVICE must be a Service Binding/,
    );
  });
});

describe("toAuthApiUser", () => {
  it("maps the auth user shape", () => {
    expect(toAuthApiUser({ ...mockUser, user_metadata: { full_name: "Jane Doe" } })).toEqual({
      id: "user-uuid-1234",
      email: "learner@rareminds.com",
      org_id: "org-1",
      roles: ["learner"],
      products: ["lte"],
      membership_status: "active",
      is_email_verified: true,
      user_metadata: { full_name: "Jane Doe" },
    });
  });

  it("defaults user_metadata to an empty object", () => {
    expect(toAuthApiUser(mockUser).user_metadata).toEqual({});
  });
});
