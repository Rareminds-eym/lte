import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/drafts";

export const onRequestPost = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).POST(request),
);
export const onRequestPut = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).PUT(request),
);
export const onRequestDelete = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).DELETE(request),
);
