import { z } from "zod";
import type { QueryGateway } from "./query-gateway";
import { callSkill } from "./skill-gateway";
import type { LteEnv } from "./types";

const tableNames = [
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
const row = z.object({ id: z.string().uuid() }).catchall(z.unknown());
const payloadSchema = z.object({
  version: z.literal(1),
  tables: z
    .object(Object.fromEntries(tableNames.map((name) => [name, z.array(row).max(50000)])))
    .strict(),
});
const importPolicy = {
  operation: "rpc",
  functionName: "import_managed_lte_catalog",
  allowedArgs: ["p_tables"],
} as const;

export async function syncManagedCatalog(
  qb: QueryGateway,
  env: LteEnv,
  roleIds: string[],
  userId: string,
): Promise<void> {
  if (roleIds.length === 0) return;
  const ids = z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .parse([...new Set(roleIds)]);
  let missing: string[];
  try {
    missing = z.array(z.string().uuid()).parse(
      await qb.rpc(
        {
          operation: "rpc",
          functionName: "missing_managed_catalog_roles",
          allowedArgs: ["p_role_ids"],
        },
        { args: { p_role_ids: ids } },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("missing_managed_catalog_roles") || message.includes("schema cache")) {
      return;
    }
    throw error;
  }
  if (missing.length === 0) return;
  if (missing.some((id) => !ids.includes(id))) throw new Error("Invalid missing catalogue scope");
  const raw = await callSkill(env, "catalogue:get", { userId, roleIds: missing }, userId);
  const payload = payloadSchema.parse(raw);

  const tables = payload.tables as Record<
    (typeof tableNames)[number],
    Array<{ id: string } & Record<string, unknown>>
  >;
  if (tableNames.some((name) => !Array.isArray(tables[name])))
    throw new Error("Incomplete catalogue response");
  const returnedIds = new Set(tables.roles.map((role) => role.id));
  if (missing.some((id) => !returnedIds.has(id)) || returnedIds.size !== missing.length)
    throw new Error("Managed catalogue does not contain the requested roles");
  await qb.rpc(importPolicy, { args: { p_tables: tables } });
}
