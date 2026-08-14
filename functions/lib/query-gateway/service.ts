import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv } from "@functions/lib/types";
import { createQueryGateway } from "./gateway";

export function createServiceQueryGateway(env: LteEnv) {
  return createQueryGateway(createServiceSupabase(env));
}
