import { describe, expect, it } from "vitest";
import { validateBackendEnv } from "../env";

const validEnv = {
  SSO_SERVICE: {},
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("validateBackendEnv", () => {
  it("returns the env when valid", () => {
    expect(validateBackendEnv(validEnv)).toEqual(validEnv);
  });

  it("rejects a missing SSO_SERVICE binding", () => {
    const { SSO_SERVICE: _ignored, ...rest } = validEnv;
    expect(() => validateBackendEnv(rest)).toThrow(/SSO_SERVICE service binding is required/);
  });

  it("rejects a null SSO_SERVICE binding", () => {
    expect(() => validateBackendEnv({ ...validEnv, SSO_SERVICE: null })).toThrow(
      /SSO_SERVICE service binding is required/,
    );
  });

  it("rejects an invalid SUPABASE_URL", () => {
    expect(() => validateBackendEnv({ ...validEnv, SUPABASE_URL: "not-a-url" })).toThrow(
      /SUPABASE_URL must be a valid URL/,
    );
  });

  it("rejects an empty SUPABASE_SERVICE_ROLE_KEY", () => {
    expect(() => validateBackendEnv({ ...validEnv, SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY must not be empty/,
    );
  });

  it("accepts a missing optional COOKIE_DOMAIN", () => {
    expect(validateBackendEnv(validEnv)).toEqual(validEnv);
  });
});
