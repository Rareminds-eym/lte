/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { exportCatalog } from "../ingestion/catalog-export";

describe("catalogue export", () => {
  it("exports only published content and skips unscoped reads for empty dependencies", async () => {
    const chains: Record<string, any> = {};
    const from = vi.fn((table: string) => {
      const rows =
        table === "roles"
          ? [{ id: "role" }]
          : table === "role_capability_sequence"
            ? [{ id: "seq", capability_id: "cap" }]
            : table === "capabilities"
              ? [{ id: "cap" }]
              : [];
      const chain: any = {
        select: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
        in: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally awaitable.
        then: (resolve: any) => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      for (const name of ["select", "order", "range", "in", "eq", "is"])
        chain[name].mockReturnValue(chain);
      chains[table] = chain;
      return chain;
    });
    const result = await exportCatalog({ from } as unknown as SupabaseClient, ["role"]);
    expect(chains["levels"].eq).toHaveBeenCalledWith("status", "published");
    expect(chains["levels"].eq).toHaveBeenCalledWith("is_active", true);
    expect(from).not.toHaveBeenCalledWith("modules");
    expect(from).not.toHaveBeenCalledWith("catalog_versions");
    expect(result.tables["roles"]).toEqual([{ id: "role" }]);
    expect(result.tables["modules"]).toEqual([]);
  });
});
