import { createAuth } from "@rareminds-eym/auth-core";
import type { LteEnv, PagesContext } from "../../shared/types";
import { type CatalogDependencies, catalogDependencies } from "./dependencies";
import { boundedBody, catalogRequest, type HttpRequest } from "./http";

const instances = new WeakMap<object, ReturnType<typeof createAuth>>();
function catalogAuth(env: LteEnv) {
  const binding = env.SSO_SERVICE;
  if (!binding) throw new Error("SSO_SERVICE is not configured");
  const cached = instances.get(binding);
  if (cached) return cached;
  const auth = createAuth({
    sso: binding as unknown as Parameters<typeof createAuth>[0]["sso"],
    issuer: "sso-api",
    audience: "sso-client",
    approvedOrigins: ["https://lte.rareminds.in", "http://localhost:8789"],
    csrf: { name: "X-RM-CSRF", value: "1" },
    cookieMaxAgeSeconds: 604800,
    ssoRequestTimeoutMs: 5000,
  });
  instances.set(binding, auth);
  return auth;
}

export function adminEndpoint(
  roles: string[],
  handle: (
    dependencies: CatalogDependencies,
    request: HttpRequest,
    context: PagesContext,
  ) => Promise<Response>,
) {
  return async (context: PagesContext): Promise<Response> => {
    try {
      const auth = catalogAuth(context.env);
      return await auth.authenticate(
        auth.requireActiveMembership(
          auth.requireRole(roles, async (request, verified) => {
            try {
              let input = request;
              if (!["GET", "HEAD"].includes(request.method)) {
                const body = await boundedBody(request, 25 * 1024 * 1024);
                if (body) JSON.parse(body);
                input = new Request(request.url, {
                  method: request.method,
                  headers: request.headers,
                  body,
                });
              }
              const user = verified.user;
              const dependencies = catalogDependencies(context.env, {
                userId: user.sub,
                id: user.sub,
                roles: user.roles,
                role: user.roles[0] || "",
              });
              const response = await handle(dependencies, catalogRequest(input), context);
              response.headers.set("Cache-Control", "no-store");
              return response;
            } catch (error) {
              if (error instanceof RangeError)
                return Response.json(
                  { success: false, error: "Request too large" },
                  { status: 413 },
                );
              if (error instanceof SyntaxError)
                return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
              return Response.json(
                { success: false, error: "Catalog service unavailable" },
                { status: 503 },
              );
            }
          }),
        ),
      )(context.request);
    } catch (error) {
      if (error instanceof RangeError)
        return Response.json({ success: false, error: "Request too large" }, { status: 413 });
      if (error instanceof SyntaxError)
        return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
      return Response.json(
        { success: false, error: "Catalog service unavailable" },
        { status: 503 },
      );
    }
  };
}
