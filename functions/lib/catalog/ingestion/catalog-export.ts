/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CATALOG_TABLES = [
  "roles",
  "capabilities",
  "level_scale",
  "role_capability_sequence",
  "skills",
  "levels",
  "level_skills",
  "modules",
  "modules_content",
  "e_content",
  "module_artifacts",
  "artifact_questions",
  "artifact_templates",
] as const;
type Row = Record<string, any>;

/** Export current published content, never ingestion drafts or learner records. */
export async function exportCatalog(db: SupabaseClient, roleIds: string[]) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    CATALOG_TABLES.map((name) => [name, []]),
  );
  let total = 0;
  async function read(
    table: string,
    column?: string,
    ids?: string[],
    filters: Record<string, unknown> = {},
  ) {
    const rows: Row[] = [];
    const groups = ids
      ? [...new Set(ids)].reduce<string[][]>((all, id, i) => {
          if (i % 100 === 0) all.push([]);
          all[all.length - 1]!.push(id);
          return all;
        }, [])
      : [undefined];
    for (const group of groups) {
      for (let offset = 0; ; offset += 500) {
        let query = db
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 499);
        if (column && group) query = query.in(column, group);
        for (const [key, value] of Object.entries(filters)) {
          query = value === null ? query.is(key, null) : query.eq(key, value);
        }
        const { data, error } = await query;
        if (error) throw new Error(`Catalogue read failed: ${table}`);
        rows.push(...(data || []));
        total += data?.length || 0;
        if (total > 50000) throw new Error("Catalogue export exceeds row limit");
        if (!data || data.length < 500) break;
      }
    }
    tables[table] = rows;
    return rows;
  }
  const ids = (rows: Row[], key = "id") => rows.map((row) => row[key] as string).filter(Boolean);
  const roles = await read("roles", "id", roleIds, { deleted_at: null });
  if (roles.length !== new Set(roleIds).size)
    throw new Error("Recommended roles are missing from the managed catalogue");
  const sequences = await read("role_capability_sequence", "role_id", roleIds);
  const capabilities = await read("capabilities", "id", ids(sequences, "capability_id"));
  await read("level_scale");
  const levels = await read(
    "levels",
    "capability_id",
    ids(capabilities.filter((row) => row["is_active"] !== false)),
    {
      status: "published",
      is_active: true,
    },
  );
  const skills = await read("level_skills", "level_id", ids(levels));
  await read("skills", "id", ids(skills, "skill_id"));
  const modules = await read("modules", "level_id", ids(levels), {
    is_published: true,
    is_active: true,
  });
  const content = await read("modules_content", "module_id", ids(modules), {
    is_active: true,
  });
  await read("e_content", "modules_content_id", ids(content), {
    status: "published",
  });
  const artifacts = await read("module_artifacts", "modules_content_id", ids(content), {
    is_active: true,
  });
  const questions = await read("artifact_questions", "artifact_id", ids(artifacts), {
    is_active: true,
  });
  const templates = await read("artifact_templates", "artifact_id", ids(artifacts));
  const questionIds = new Set(ids(questions));
  tables["artifact_templates"] = templates.filter(
    (row) => !row["question_id"] || questionIds.has(row["question_id"]),
  );
  return { version: 1, tables };
}
