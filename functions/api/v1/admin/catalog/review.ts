import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/review";

export const onRequestGet = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).GET(request),
);
export const onRequestPatch = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).PATCH(request),
);
