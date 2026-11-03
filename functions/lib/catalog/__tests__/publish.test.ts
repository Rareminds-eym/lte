/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ingestion/snapshot-serializer", () => ({
  calculateHash: vi.fn(() => "test-snapshot-hash"),
}));

import type { CatalogDependencies } from "../dependencies";
import { createHandlers } from "../publish";

const authenticateSSORequest = vi.fn();
const supabaseLTE = { from: vi.fn() };
const { POST } = createHandlers({
  db: supabaseLTE,
  authenticate: authenticateSSORequest,
  env: {},
  publishOptions: { supabase: supabaseLTE, storage: {} },
} as unknown as CatalogDependencies);
class NextRequest extends Request {
  get nextUrl() {
    return new URL(this.url);
  }
}

describe("POST /api/admin/lte/publish", () => {
  const mockUser = {
    userId: "test-user-123",
    role: "super_admin",
    email: "admin@test.com",
  };

  const mockVersion = {
    id: "version-123",
    entity_type: "catalog",
    entity_id: null,
    version_no: 1,
    status: "VALIDATED",
    snapshot_hash: "test-snapshot-hash",
    snapshot_data: {
      tables: {
        roles: {
          columns: ["id", "role_name"],
          rows: [["CLSP_CAPCREDIT_L1_CREDIT_PROCESSING_001", "Designer"]],
        },
        capabilities: {
          columns: ["id", "code"],
          rows: [["MEG_IND-CAP-19", "MEG_IND-CAP-19"]],
        },
        level_scale: {
          columns: ["id", "level_no", "level_code"],
          rows: [["L1", 1, "L1"]],
        },
        levels: {
          columns: ["id", "capability_id", "level_id", "level_code", "title"],
          rows: [
            ["MEG_CAP19_L1_CL001", "MEG_IND-CAP-19", "L1", "MEG_CAP19_L1", "Activation readiness"],
          ],
        },
        modules: {
          columns: ["id", "level_id", "module_no", "title"],
          rows: [["MEG_CAP19_L1_CL001_M0", "MEG_CAP19_L1_CL001", 0, "Module 0"]],
        },
      },
      metadata: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateSSORequest).mockResolvedValue({ user: mockUser, error: null });
    let currentVersion = structuredClone(mockVersion);

    const chainable = (resolved: any) => {
      const chain: any = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
        single: vi.fn(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally awaitable.
        then: (resolve: any, reject: any) => Promise.resolve(resolved).then(resolve, reject),
      };
      chain.maybeSingle.mockResolvedValue(resolved);
      chain.single.mockResolvedValue(resolved);
      return chain;
    };

    vi.mocked(supabaseLTE.from).mockImplementation((tableName: string) => {
      if (tableName === "catalog_versions") {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            const chain: any = chainable({ data: currentVersion, error: null });
            // Level-version lookup returns no existing version by default.
            chain.maybeSingle.mockImplementation(() =>
              Promise.resolve({
                data:
                  columns === "id" || columns.includes("snapshot_data")
                    ? structuredClone(currentVersion)
                    : null,
                error: null,
              }),
            );
            // Keep single() for the catalog version fetch.
            chain.single.mockImplementation(() =>
              Promise.resolve({ data: currentVersion, error: null }),
            );
            // Distinguish by call: fetch by id uses .single(), version lookup uses .maybeSingle().
            return chain;
          }),
          update: vi.fn().mockImplementation((payload) => {
            currentVersion = { ...currentVersion, ...structuredClone(payload) };
            return chainable({ data: { id: currentVersion.id }, error: null });
          }),
          insert: vi.fn().mockReturnValue(chainable({ error: null })),
        } as any;
      }
      if (tableName === "capabilities") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: "11111111-1111-4111-8111-111111111111", code: "MEG_IND-CAP-19" }],
            error: null,
          }),
        } as any;
      }
      if (tableName === "level_scale") {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: "22222222-2222-4222-8222-222222222222", level_no: 1, level_label: "L1" }],
            error: null,
          }),
        } as any;
      }
      if (tableName === "skills") {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }
      if (tableName === "levels") {
        return {
          select: vi.fn().mockImplementation(() => chainable({ data: null, error: null })),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }

      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      } as any;
    });
  });

  it("rejects unauthorized requests", async () => {
    vi.mocked(authenticateSSORequest).mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/lte/publish", {
        method: "POST",
        body: JSON.stringify({
          uploadId: "version-123",
          reviewedSnapshotHash: "test-snapshot-hash",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects missing request fields", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/lte/publish", {
        method: "POST",
        body: JSON.stringify({ uploadId: "version-123" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("publishes a validated catalog version", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/lte/publish", {
        method: "POST",
        body: JSON.stringify({
          uploadId: "version-123",
          reviewedSnapshotHash: "test-snapshot-hash",
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("published");
    expect(supabaseLTE.from).toHaveBeenCalledWith("catalog_versions");
    expect(supabaseLTE.from).toHaveBeenCalledWith("capabilities");
    expect(supabaseLTE.from).toHaveBeenCalledWith("level_scale");
    expect(supabaseLTE.from).toHaveBeenCalledWith("levels");
    expect(supabaseLTE.from).toHaveBeenCalledWith("modules");
    expect(supabaseLTE.from).not.toHaveBeenCalledWith("roles");
  });
});
