import { describe, expect, it, vi } from "vitest";
import { exchangeSsoCode, refreshSession, fetchMe, logoutSession } from "@/shared/api/authApi";

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "Error",
    json: () => Promise.resolve(body),
  });
}

describe("authApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("exchangeSsoCode", () => {
    it("returns auth response on success", async () => {
      const response = { access_token: "token", user: { id: "1" } };
      mockFetch(200, response);

      const result = await exchangeSsoCode({
        code: "abc",
        state: "def",
        redirectUri: "http://localhost/auth/callback",
      });

      expect(result.access_token).toBe("token");
    });

    it("throws on non-ok response", async () => {
      mockFetch(401, { error: "invalid_grant" });
      await expect(
        exchangeSsoCode({ code: "bad", state: "bad", redirectUri: "x" }),
      ).rejects.toThrow("invalid_grant");
    });

    it("throws statusText when error field is missing", async () => {
      mockFetch(404, {});
      await expect(exchangeSsoCode({ code: "a", state: "b", redirectUri: "c" })).rejects.toThrow(
        "Not Found",
      );
    });
  });

  describe("refreshSession", () => {
    it("returns refresh response on success", async () => {
      mockFetch(200, { access_token: "refreshed" });
      const result = await refreshSession();
      expect(result.access_token).toBe("refreshed");
    });

    it("throws on failure", async () => {
      mockFetch(500, {});
      await expect(refreshSession()).rejects.toThrow("Error");
    });
  });

  describe("fetchMe", () => {
    it("returns user on success", async () => {
      mockFetch(200, { user: { id: "u1", email: "a@b.com" } });
      const result = await fetchMe("token123");
      expect(result.user.email).toBe("a@b.com");
    });

    it("throws on failure", async () => {
      mockFetch(403, { error: "forbidden" });
      await expect(fetchMe("bad-token")).rejects.toThrow("forbidden");
    });
  });

  describe("logoutSession", () => {
    it("returns logout response", async () => {
      mockFetch(200, { success: true });
      const result = await logoutSession();
      expect(result.success).toBe(true);
    });
  });

  describe("parseJsonResponse error handling", () => {
    it("throws statusText when JSON is invalid", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });
      await expect(refreshSession()).rejects.toThrow("Internal Server Error");
    });

    it("throws statusText when payload is not an object", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: () => Promise.resolve("not an object"),
      });
      await expect(refreshSession()).rejects.toThrow("Bad Gateway");
    });
  });
});
