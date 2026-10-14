import { adminEndpoint } from "../../../../lib/catalog/auth";
import { createHandlers } from "../../../../lib/catalog/course-content";

export const onRequestGet = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).GET(request),
);
export const onRequestPut = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).PUT(request),
);
export const onRequestPost = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).POST(request),
);
export const onRequestDelete = adminEndpoint(
  ["admin", "super_admin", "platform_admin"],
  (dependencies, request) => createHandlers(dependencies).DELETE(request),
);
