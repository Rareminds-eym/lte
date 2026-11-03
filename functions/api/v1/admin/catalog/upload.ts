import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/upload";
export const onRequestPost = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).POST(request),
);
