import type { PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { expect, it, vi } from "vitest";
import { learnerCertificateMiddleware } from "../learnerMiddleware";
import { env, userId } from "./fixtures";

vi.mock("@functions/middleware", async (original) => ({
  ...(await original<typeof import("@functions/middleware")>()),
  requireAuth: vi.fn(),
}));
it("uses canonical auth once and propagates generated correlation to the SSO boundary", async () => {
  vi.mocked(requireAuth).mockResolvedValue({ sub: userId } as Awaited<
    ReturnType<typeof requireAuth>
  >);
  const ctx = {
    env,
    data: {},
    request: new Request("https://lte.test/api/v1/certificates"),
    next: vi.fn().mockResolvedValue(new Response()),
  } as unknown as PagesContext;
  const response = await learnerCertificateMiddleware(ctx);
  expect(response.status).toBe(200);
  const authRequest = vi.mocked(requireAuth).mock.calls.at(-1)![0];
  expect(authRequest.headers.get("X-Request-Id")).toBe(response.headers.get("X-Request-Id"));
  expect(ctx.data?.["user"]).toMatchObject({ sub: userId });
  vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));
  expect((await learnerCertificateMiddleware(ctx)).status).toBe(403);
});
