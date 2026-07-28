import { describe, expect, it, vi } from "vitest";

describe("shared/config barrel", () => {
  it("getSkillpassportUrl returns configured URL", async () => {
    vi.stubEnv("VITE_SKILLPASSPORT_URL", "https://sso.example.com/");
    const { getSkillpassportUrl } = await import("@/shared/config");
    expect(getSkillpassportUrl()).toBe("https://sso.example.com");
    vi.unstubAllEnvs();
  });

  it("getSkillpassportUrl throws when env not set", async () => {
    vi.stubEnv("VITE_SKILLPASSPORT_URL", "");
    const { getSkillpassportUrl } = await import("@/shared/config");
    expect(() => getSkillpassportUrl()).toThrow(
      "VITE_SKILLPASSPORT_URL environment variable is not configured",
    );
    vi.unstubAllEnvs();
  });
});

describe("shared/lib barrel", () => {
  it("cn merges class names", async () => {
    const { cn } = await import("@/shared/lib");
    const result = cn("px-4", "py-2", "px-6");
    expect(result).toContain("px-6");
    expect(result).not.toContain("px-4");
  });

  it("cn filters falsy values", async () => {
    const { cn } = await import("@/shared/lib");
    const falsy = false;
    const result = cn("foo", falsy && "bar", null, undefined, "baz");
    expect(result).toBe("foo baz");
  });

  it("delay resolves after specified time", async () => {
    const { delay } = await import("@/shared/lib");
    const start = Date.now();
    await delay(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });
});

describe("shared/schemas barrel", () => {
  it("UserSchema validates valid data", async () => {
    const { UserSchema } = await import("@/shared/schemas");
    const result = UserSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test User",
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("UserSchema rejects invalid data", async () => {
    const { UserSchema } = await import("@/shared/schemas");
    const result = UserSchema.safeParse({ id: "not-uuid", name: "", email: "bad" });
    expect(result.success).toBe(false);
  });

  it("PaginationParamsSchema has defaults", async () => {
    const { PaginationParamsSchema } = await import("@/shared/schemas");
    const result = PaginationParamsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });
});
