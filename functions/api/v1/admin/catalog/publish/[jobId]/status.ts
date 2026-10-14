import { adminEndpoint } from "../../../../../../lib/catalog/auth";
import { createHandlers } from "../../../../../../lib/catalog/status";
export const onRequestGet = adminEndpoint(
  ["super_admin", "platform_admin"],
  (dependencies, request, context) =>
    createHandlers(dependencies).GET(request, {
      params: Promise.resolve({ jobId: context.params["jobId"]! }),
    }),
);
