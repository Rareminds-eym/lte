import type { AuthUser } from "@rareminds-eym/auth-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, extractBearerToken, requireAuth, toAuthApiUser } from "../auth";
import { getMe, SsoAuthError } from "../sso-client";

vi.mock("../sso-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sso-client")>();
  return { ...actual, getMe: vi.fn() };
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

const mockEnv = {
  SSO_SERVICE: {},
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.example.com",
  SKILLPASSPORT_INTERNAL_SECRET: "a-secret-that-is-at-least-32-characters-long",
} as never;

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
  });

  it("throws UNAUTHORIZED when no token is present", async () => {
    await expect(requireAuth(new Request("http://localhost"), mockEnv)).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHORIZED",
    });
  });

  it("returns the user when the token is valid and lte is a product", async () => {
    vi.mocked(getMe).mockResolvedValueOnce(mockUser);
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).resolves.toEqual(mockUser);
  });

  it("rethrows AuthError from getMe", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new AuthError("Downstream denied", "UNAUTHORIZED"));
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("maps SsoAuthError to UNAUTHORIZED AuthError", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new SsoAuthError("Invalid or revoked session"));
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHORIZED",
    });
  });

  it("wraps generic errors from getMe", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new Error("connection reset"));
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toThrow(
      "Unexpected auth error: connection reset",
    );
  });

  it("wraps non-Error rejections from getMe", async () => {
    vi.mocked(getMe).mockRejectedValueOnce("boom");
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toThrow("Unexpected auth error: boom");
  });

  it("throws FORBIDDEN when the user lacks the lte product", async () => {
    vi.mocked(getMe).mockResolvedValueOnce({ ...mockUser, products: ["other"] });
    const request = new Request("http://localhost", {
      headers: { authorization: "Bearer token-123" },
    });
    await expect(requireAuth(request, mockEnv)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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
