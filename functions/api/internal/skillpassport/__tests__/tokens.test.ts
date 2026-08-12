import type { LteEnv } from "@functions/lib/types";
import { describe, expect, it } from "vitest";
import {
  GatewayAuthError,
  getGatewaySecret,
  signServiceToken,
  verifyServiceToken,
} from "../tokens";

const VALID_SECRET = "a-real-gateway-secret-that-is-long-enough";

describe("getGatewaySecret", () => {
  it("returns the secret when it is configured and long enough", () => {
    const env = { SKILLPASSPORT_INTERNAL_SECRET: VALID_SECRET } as unknown as LteEnv;
    expect(getGatewaySecret(env)).toBe(VALID_SECRET);
  });

  it("returns a secret of exactly 32 characters", () => {
    const secret = "x".repeat(32);
    const env = { SKILLPASSPORT_INTERNAL_SECRET: secret } as unknown as LteEnv;
    expect(getGatewaySecret(env)).toBe(secret);
  });

  it("throws FORBIDDEN when the secret is missing", () => {
    const env = {} as unknown as LteEnv;
    expect(() => getGatewaySecret(env)).toThrow(GatewayAuthError);
    expect(() => getGatewaySecret(env)).toThrow("Gateway secret is missing or too short");
  });

  it("throws FORBIDDEN when the secret is shorter than 32 characters", () => {
    const env = { SKILLPASSPORT_INTERNAL_SECRET: "short" } as unknown as LteEnv;
    expect(() => getGatewaySecret(env)).toThrow(GatewayAuthError);
    expect(() => getGatewaySecret(env)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    try {
      getGatewaySecret(env);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayAuthError);
      expect((error as GatewayAuthError).code).toBe("FORBIDDEN");
    }
  });
});

describe("auth re-exports", () => {
  it("exposes the shared gateway crypto primitives", () => {
    expect(signServiceToken).toBeTypeOf("function");
    expect(verifyServiceToken).toBeTypeOf("function");
  });

  it("forwards GatewayAuthError", () => {
    expect(GatewayAuthError).toBeTypeOf("function");
  });
});
