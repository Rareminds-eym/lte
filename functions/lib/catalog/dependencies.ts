import type { SupabaseClient } from "@supabase/supabase-js";
import type { LteEnv } from "../../shared/types";
import { createServiceSupabase } from "../supabase";
import type { R2BucketLike } from "./ingestion/r2-storage";
import { R2StorageService } from "./ingestion/r2-storage";

export interface CatalogActor {
  userId: string;
  id: string;
  role: string;
  roles: readonly string[];
}
export interface CatalogDependencies {
  db: SupabaseClient;
  env: LteEnv;
  user: CatalogActor;
  bucket: R2BucketLike;
  publishOptions: { supabase: SupabaseClient; storage: R2StorageService };
  authenticate(
    request: Request,
    roles: string[],
  ): Promise<{ user: CatalogActor | null; error: Response | null }>;
}

export function catalogDependencies(env: LteEnv, user: CatalogActor): CatalogDependencies {
  const db = createServiceSupabase(env);
  const bucket = env.STORAGE_BUCKET as unknown as R2BucketLike;
  return {
    db,
    env,
    user,
    bucket,
    publishOptions: { supabase: db, storage: new R2StorageService(bucket) },
    authenticate: async (_request, roles) =>
      user.roles.some((role) => roles.includes(role))
        ? { user, error: null }
        : {
            user: null,
            error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }),
          },
  };
}
