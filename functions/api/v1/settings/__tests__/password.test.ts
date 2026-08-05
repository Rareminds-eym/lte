import { AuthError, requireAuth } from "@functions/lib/auth";
import { changeSsoPassword } from "@functions/lib/sso-client";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../password";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/sso-client", () => ({ changeSsoPassword: vi.fn() }));

const mockUser: AuthUser = {
  sub: "user-uuid-1234",
  email: "learner@rareminds.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
};

function postContext(body: Record<string, unknown>, withToken = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (withToken) {
    headers.set("authorization", "Bearer access-token-123");
  }
  return {
    request: new Request("http://localhost/api/v1/settings/password", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    env: {} as LteEnv,
  } as PagesContext<LteEnv>;
}

describe("POST /api/v1/settings/password", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestPost(postContext({}));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 401 when the bearer token is missing", async () => {
    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }, false),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when the current password is missing", async () => {
    const response = await onRequestPost(postContext({ new_password: "newpass123" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the new password is too short", async () => {
    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "short" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("changes the password via the SSO service", async () => {
    vi.mocked(changeSsoPassword).mockResolvedValueOnce({
      success: true,
      message: "Password changed successfully",
    });

    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Password changed successfully");

    expect(changeSsoPassword).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        current_password: "oldpass",
        new_password: "newpass123",
        access_token: "access-token-123",
      }),
    );
  });

  it("uses the default message when the SSO service returns none", async () => {
    vi.mocked(changeSsoPassword).mockResolvedValueOnce({ success: true });

    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Password changed successfully");
  });

  it("returns 403 when changeSsoPassword throws FORBIDDEN", async () => {
    vi.mocked(changeSsoPassword).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));

    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when the SSO service fails", async () => {
    vi.mocked(changeSsoPassword).mockRejectedValueOnce(new Error("SSO down"));

    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("PASSWORD_CHANGE_FAILED");
    expect(body.error.message).toBe("Password change failed");
  });

  it("does not leak internal error details on failure", async () => {
    vi.mocked(changeSsoPassword).mockRejectedValueOnce("SSO down");

    const response = await onRequestPost(
      postContext({ current_password: "oldpass", new_password: "newpass123" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe("Password change failed");
    expect(body.error.message).not.toContain("SSO down");
  });
});
