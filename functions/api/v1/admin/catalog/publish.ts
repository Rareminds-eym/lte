import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/publish";

export const onRequestPost = adminEndpoint(
  ["super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).POST(request),
);
