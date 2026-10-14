import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LteEnv, PagesContext } from "../../../shared/types";
import { adminEndpoint } from "../auth";

vi.mock("../../supabase", () => ({ createServiceSupabase: vi.fn(() => ({})) }));
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let env: LteEnv;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  const publicKey = {
    ...(await exportJWK(keys.publicKey)),
    kid: "catalog-test",
    alg: "RS256",
    use: "sig",
    status: "active",
  };
  env = {
    SSO_SERVICE: {
      getJwks: async ({ correlationId }: { correlationId: string }) => ({
        kind: "succeeded",
        correlationId,
        keys: [publicKey],
        freshnessSeconds: 60,
      }),
    },
    STORAGE_BUCKET: {},
  } as unknown as LteEnv;
});
async function token(
  roles = ["admin"],
  membership_status = "active",
  audience = "sso-client",
  expires = 60,
) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: "admin@example.com",
    org_id: "org",
    roles,
    products: ["skillpassport"],
    membership_status,
    is_email_verified: true,
  })
    .setSubject("verified-user")
    .setIssuer("sso-api")
    .setAudience(audience)
    .setIssuedAt(now - 10)
    .setExpirationTime(now + expires)
    .setProtectedHeader({ alg: "RS256", kid: "catalog-test", typ: "JWT" })
    .sign(keys.privateKey);
}
function context(request: Request): PagesContext {
  return {
    env,
    request,
    params: {},
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(),
  };
}
describe("catalog admin authentication with real signed tokens", () => {
  it("uses the issued SSO audience and verified actor, without a learner product requirement", async () => {
    const endpoint = adminEndpoint(["admin"], async (dependencies) =>
      Response.json({ userId: dependencies.user.userId }),
    );
    const result = await endpoint(
      context(
        new Request("https://lte.example.com/api/v1/admin/catalog/workspace", {
          headers: {
            authorization: `Bearer ${await token()}`,
            cookie: 'sso_user={"role":"super_admin"}',
          },
        }),
      ),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ userId: "verified-user" });
  });
  it("rejects anonymous, expired, wrong-audience and inactive tokens", async () => {
    const handle = vi.fn(async () => new Response());
    const endpoint = adminEndpoint(["admin"], handle);
    expect((await endpoint(context(new Request("https://lte.example.com/")))).status).toBe(401);
    for (const value of [
      await token(["admin"], "active", "sp-dash-2"),
      await token(["admin"], "active", "sso-client", -1),
    ]) {
      expect(
        (
          await endpoint(
            context(
              new Request("https://lte.example.com/", {
                headers: { authorization: `Bearer ${value}` },
              }),
            ),
          )
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await endpoint(
          context(
            new Request("https://lte.example.com/", {
              headers: { authorization: `Bearer ${await token(["admin"], "suspended")}` },
            }),
          ),
        )
      ).status,
    ).toBe(403);
    expect(handle).not.toHaveBeenCalled();
  });
  it("does not elevate a plain admin using a forged cookie on the publish endpoint", async () => {
    const handle = vi.fn(async () => new Response());
    const endpoint = adminEndpoint(["super_admin", "platform_admin"], handle);
    const result = await endpoint(
      context(
        new Request("https://lte.example.com/", {
          headers: {
            authorization: `Bearer ${await token()}`,
            cookie: 'sso_user={"role":"super_admin"}',
          },
        }),
      ),
    );
    expect(result.status).toBe(403);
    expect(handle).not.toHaveBeenCalled();
  });
  it("bounds streaming bodies and returns a client error for malformed JSON", async () => {
    const endpoint = adminEndpoint(["admin"], async (_dependencies, request) =>
      Response.json(await request.json()),
    );
    const headers = {
      authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    };
    expect(
      (
        await endpoint(
          context(
            new Request("https://lte.example.com/", { method: "POST", headers, body: "broken" }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await endpoint(
          context(
            new Request("https://lte.example.com/", {
              method: "POST",
              headers: { ...headers, "Content-Length": String(26 * 1024 * 1024) },
              body: "{}",
            }),
          ),
        )
      ).status,
    ).toBe(413);
  });
});
