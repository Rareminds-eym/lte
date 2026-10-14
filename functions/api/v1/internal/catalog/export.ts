import { z } from "zod";
import { exportCatalog } from "../../../../lib/catalog/ingestion/catalog-export";
import { internalEndpoint } from "../../../../lib/catalog/internal-auth";
import { createServiceSupabase } from "../../../../lib/supabase";

const schema = z.object({ roleIds: z.array(z.string().uuid()).min(1).max(100) }).strict();
export const onRequestPost = internalEndpoint(async (context, body) => {
  const payload = schema.safeParse(JSON.parse(body));
  if (!payload.success) return Response.json({ error: "Invalid role IDs" }, { status: 400 });
  return Response.json(
    await exportCatalog(createServiceSupabase(context.env), payload.data.roleIds),
  );
});
