/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase test double models heterogeneous persisted catalog rows. */
import { vi } from "vitest";
import type { CatalogDependencies } from "../dependencies";
import { catalogRequest } from "../http";

export const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  id: "11111111-1111-4111-8111-111111111111",
  role: "super_admin",
  roles: ["super_admin"],
};
export const id = "22222222-2222-4222-8222-222222222222";
export const sourceUrl = "https://drive.google.com/file/d/document-id/view";
const tableNames = [
  "roles",
  "capabilities",
  "level_scale",
  "levels",
  "role_capability_sequence",
  "skills",
  "level_skills",
  "modules",
  "modules_content",
  "e_content",
  "module_artifacts",
  "artifact_questions",
  "artifact_templates",
  "catalog_versions",
] as const;
type MemoryTables = Record<(typeof tableNames)[number], any[]> & Record<string, any[]>;
function field(row: any, column: string): any {
  return column.split(/->>?|\./).reduce((value: any, key: string) => value?.[key], row);
}
export class MemoryDb {
  tables: MemoryTables;
  calls: Array<{
    table: string;
    operation: string;
    values: any;
    filters: Array<[string, string, any]>;
  }> = [];
  failures = new Map<string, string>();
  beforeExecute?: (query: { table: string; operation: string }) => Promise<void>;
  constructor(tables: Record<string, any[]> = {}) {
    this.tables = {
      ...Object.fromEntries(tableNames.map((name) => [name, []])),
      ...structuredClone(tables),
    } as MemoryTables;
  }
  from(table: string) {
    const state = {
      table,
      operation: "read",
      values: undefined as any,
      filters: [] as Array<[string, string, any]>,
    };
    let single = false,
      required = false,
      head = false,
      count = false,
      offset = 0,
      end = Infinity,
      sortColumn = "",
      ascending = true;
    const query: any = {
      select: (_columns: string, options?: { count?: string; head?: boolean }) => {
        head = !!options?.head;
        count = !!options?.count;
        return query;
      },
      update: (values: any) => {
        state.operation = "update";
        state.values = values;
        return query;
      },
      insert: (values: any) => {
        state.operation = "insert";
        state.values = values;
        return query;
      },
      upsert: (values: any) => {
        state.operation = "upsert";
        state.values = values;
        return query;
      },
      delete: () => {
        state.operation = "delete";
        return query;
      },
      eq: (column: string, value: any) => {
        state.filters.push(["eq", column, value]);
        return query;
      },
      is: (column: string, value: any) => {
        state.filters.push(["is", column, value]);
        return query;
      },
      in: (column: string, value: any) => {
        state.filters.push(["in", column, value]);
        return query;
      },
      ilike: (column: string, value: string) => {
        state.filters.push(["ilike", column, value]);
        return query;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        sortColumn = column;
        ascending = options?.ascending !== false;
        return query;
      },
      range: (first: number, last: number) => {
        offset = first;
        end = last + 1;
        return query;
      },
      limit: (length: number) => {
        end = offset + length;
        return query;
      },
      single: () => {
        single = true;
        required = true;
        return query;
      },
      maybeSingle: () => {
        single = true;
        return query;
      },
      // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally awaitable.
      then: (resolve: any, reject: any) => execute().then(resolve, reject),
    };
    const execute = async () => {
      await this.beforeExecute?.(state);
      this.calls.push(structuredClone(state));
      const failure = this.failures.get(`${table}:${state.operation}`);
      if (failure)
        return { data: null, error: { message: failure, code: "TEST_ERROR" }, count: null };
      this.tables[table] ??= [];
      const rows = this.tables[table];
      let matches = rows.filter((row) =>
        state.filters.every(([op, column, wanted]) => {
          const actual = field(row, column);
          if (op === "is") return wanted === null ? actual == null : actual === wanted;
          if (op === "in") return wanted.includes(actual);
          if (op === "ilike")
            return String(actual ?? "")
              .toLowerCase()
              .includes(wanted.replaceAll("%", "").toLowerCase());
          return actual === wanted;
        }),
      );
      if (state.operation === "insert" || state.operation === "upsert") {
        matches = (Array.isArray(state.values) ? state.values : [state.values]).map(
          (value: any) => {
            const existing =
              state.operation === "upsert" ? rows.find((row) => row.id === value.id) : undefined;
            if (existing) {
              Object.assign(existing, structuredClone(value));
              return existing;
            }
            const row = { id: crypto.randomUUID(), draft_revision: 1, ...structuredClone(value) };
            rows.push(row);
            return row;
          },
        );
      } else if (state.operation === "update")
        matches.forEach((row) => {
          Object.assign(row, structuredClone(state.values));
        });
      else if (state.operation === "delete")
        this.tables[table] = rows.filter((row) => !matches.includes(row));
      const total = matches.length;
      if (sortColumn)
        matches.sort(
          (a, b) =>
            String(field(a, sortColumn) ?? "").localeCompare(String(field(b, sortColumn) ?? "")) *
            (ascending ? 1 : -1),
        );
      matches = matches.slice(offset, end);
      if (required && !matches.length)
        return { data: null, error: { message: "Not found", code: "PGRST116" }, count: total };
      return {
        data: head ? null : structuredClone(single ? (matches[0] ?? null) : matches),
        error: null,
        count: count ? total : null,
      };
    };
    return query;
  }
  dependencies(extra: Partial<CatalogDependencies> = {}): CatalogDependencies {
    return {
      db: this,
      env: {},
      user: actor,
      authenticate: vi.fn(async () => ({ user: actor, error: null })),
      bucket: {},
      publishOptions: { supabase: this, storage: {} },
      ...extra,
    } as unknown as CatalogDependencies;
  }
}
export function request(method = "GET", body?: unknown, query = "") {
  return catalogRequest(
    new Request(`https://lte.example.com/api/v1/admin/catalog/test${query}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
export function catalogFixture() {
  return new MemoryDb({
    roles: [{ id, role_name: "Engineer", domain_name: "Manufacturing", deleted_at: null }],
    capabilities: [{ id, code: "CAP", name: "Capability", slug: "cap", master_sequence: 1 }],
    level_scale: [{ id, level_no: 1, level_label: "L1" }],
    levels: [
      {
        id,
        level_code: "CAP_L1",
        title: "Course",
        capability_id: id,
        level_id: id,
        status: "published",
        is_active: true,
        version_no: 1,
        capabilities: { id, code: "CAP", name: "Capability" },
        level_scale: { level_no: 1 },
      },
    ],
    role_capability_sequence: [
      {
        id,
        role_id: id,
        capability_id: id,
        sequence_step: 1,
        required_level: 1,
        roles: { id, role_name: "Engineer" },
        capabilities: { id, code: "CAP", name: "Capability" },
      },
    ],
    modules: [{ id, level_id: id, module_no: 0, title: "Module", is_published: true }],
    modules_content: [{ id, module_id: id, stage_name: "Engage", stage_order: 1 }],
    e_content: [
      {
        id,
        modules_content_id: id,
        module_id: id,
        url: "/api/admin/lte/assets?key=resources/file.pdf",
        content_type: "pdf",
      },
    ],
    module_artifacts: [{ id, modules_content_id: id, artifact_type: "practice" }],
    artifact_questions: [{ id, artifact_id: id, title: "Question" }],
    artifact_templates: [
      { id, artifact_id: id, file_url: "/api/admin/lte/assets?key=resources/template.xlsx" },
    ],
    catalog_versions: [
      {
        id,
        entity_type: "level",
        entity_id: id,
        version_no: 1,
        status: "PUBLISHED",
        draft_revision: 1,
        created_at: "2026-10-14T00:00:00Z",
        published_at: "2026-10-14T00:00:00Z",
        snapshot_data: {
          kind: "workspace_edit",
          course: { course_name: "Restored" },
          modules: [],
          eContent: [],
        },
      },
    ],
  });
}
