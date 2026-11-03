import { z } from "zod";
import { CATALOG_TABLES } from "../../../../lib/catalog/ingestion/catalog-export";
import { internalEndpoint } from "../../../../lib/catalog/internal-auth";
import { createServiceSupabase } from "../../../../lib/supabase";
export const onRequestPost = internalEndpoint(async (context, body) => {
  if (!z.object({}).strict().safeParse(JSON.parse(body)).success)
    return Response.json({ error: "Invalid diagnostics request" }, { status: 400 });
  const db = createServiceSupabase(context.env);
  const tables = Object.fromEntries(
    await Promise.all(
      CATALOG_TABLES.map(async (table) => {
        const result = await db.from(table).select("id", { count: "exact", head: true });
        if (result.error) throw new Error(`Cannot read catalog table ${table}`);
        return [table, result.count || 0];
      }),
    ),
  );
  return Response.json({ success: true, tables });
});
