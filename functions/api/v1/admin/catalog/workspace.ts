import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/workspace";

export const onRequestGet = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).GET(request),
);
