import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getAuthInstance } from "@functions/middleware/auth";

/** Review authority comes from a trusted assignment, not a learner subscription.
 * The handler additionally checks live SSO status and the current school/college
 * relationship on every read/mutation. This does not widen learner endpoints. */
export async function onRequest(context: PagesContext<LteEnv>): Promise<Response> {
  const auth = getAuthInstance(context.env);
  return auth.authenticate(
    auth.requireActiveMembership(async (_request, verified) => {
      context.data = { ...context.data, user: verified.user };
      return context.next();
    }),
  )(context.request);
}
