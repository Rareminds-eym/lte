import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv } from "@functions/lib/types";
import { createQueryGateway } from "./gateway";

export function createServiceQueryGateway(
  env: LteEnv,
  correlation?: { requestId: string; traceparent: string },
) {
  return createQueryGateway(createServiceSupabase(env, correlation));
}
