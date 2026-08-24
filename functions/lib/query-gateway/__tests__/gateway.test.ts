import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createQueryGateway, QueryGatewayDatabaseError, QueryGatewayError } from "../index";

interface MockChain {
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>;
}

function createChain(data: unknown = [], error: unknown = null): MockChain {
  const chain: MockChain = {
    eq: vi.fn().mockImplementation(() => chain),
    neq: vi.fn().mockImplementation(() => chain),
    gt: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    lte: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    ilike: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    select: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable.
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

function createSupabase(chain: MockChain): SupabaseClient {
  return {
    from: vi.fn().mockImplementation(() => chain),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as SupabaseClient;
}

describe("query gateway", () => {
  it("reads with allowed filters, sorting, and clamped pagination", async () => {
    const chain = createChain([{ id: "level-1" }]);
    const supabase = createSupabase(chain);
    const qb = createQueryGateway(supabase);

    const data = await qb.read(
      {
        table: "levels",
        operation: "read",
        columns: ["id", "title"],
        filters: ["status"],
        sorts: ["title"],
        defaultFilters: [{ column: "status", op: "eq", value: "published" }],
        maxPageSize: 25,
      },
      {
        sort: [{ column: "title", ascending: false }],
        page: 2,
        pageSize: 100,
      },
    );

    expect(data).toEqual([{ id: "level-1" }]);
    expect(supabase.from).toHaveBeenCalledWith("levels");
    expect(chain.select).toHaveBeenCalledWith("id,title");
    expect(chain.eq).toHaveBeenCalledWith("status", "published");
    expect(chain.order).toHaveBeenCalledWith("title", { ascending: false });
    expect(chain.range).toHaveBeenCalledWith(25, 49);
  });

  it("rejects disallowed read filters", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.read(
        {
          table: "levels",
          operation: "read",
          columns: ["id"],
          filters: ["id"],
        },
        {
          filters: [{ column: "secret", op: "eq", value: true }],
        },
      ),
    ).rejects.toMatchObject({ code: "COLUMN_NOT_ALLOWED" });
  });

  it("rejects select all in policy reads", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.read({
        table: "levels",
        operation: "read",
        select: "*",
      }),
    ).rejects.toMatchObject({ code: "SELECT_ALL_NOT_ALLOWED" });
  });

  it("sets ownership from auth context on insert and rejects payload user_id", async () => {
    const chain = createChain({ id: "profile-1" });
    const qb = createQueryGateway(createSupabase(chain));

    await qb.insert(
      {
        table: "user_profiles",
        operation: "insert",
        insertColumns: ["full_name"],
        returningColumns: ["id", "user_id"],
        ownership: { column: "user_id", source: "authenticatedUserId", required: true },
      },
      { full_name: "Jane" },
      { auth: { userId: "user-1" } },
    );

    expect(chain.insert).toHaveBeenCalledWith({ full_name: "Jane", user_id: "user-1" });
    expect(chain.select).toHaveBeenCalledWith("id,user_id");

    await qb.insert(
      {
        table: "user_profiles",
        operation: "insert",
        insertColumns: ["full_name"],
        returningColumns: ["id"],
      },
      { full_name: "Jane" },
      { result: "single" },
    );

    expect(chain.single).toHaveBeenCalled();

    await expect(
      qb.insert(
        {
          table: "user_profiles",
          operation: "insert",
          insertColumns: ["full_name"],
          ownership: { column: "user_id", source: "authenticatedUserId", required: true },
        },
        { full_name: "Jane", user_id: "user-2" },
        { auth: { userId: "user-1" } },
      ),
    ).rejects.toMatchObject({ code: "OWNERSHIP_PAYLOAD_NOT_ALLOWED" });
  });

  it("rejects request-controlled ownership filter on update", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.update(
        {
          table: "user_profiles",
          operation: "update",
          updateColumns: ["full_name"],
          filters: ["user_id"],
          requireFilter: true,
          ownership: { column: "user_id", source: "authenticatedUserId", required: true },
        },
        {
          auth: { userId: "user-1" },
          filters: [{ column: "user_id", op: "eq", value: "user-2" }],
          data: { full_name: "Jane" },
        },
      ),
    ).rejects.toMatchObject({ code: "OWNERSHIP_FILTER_NOT_ALLOWED" });
  });

  it("adds backend ownership filter on update", async () => {
    const chain = createChain({ id: "profile-1" });
    const qb = createQueryGateway(createSupabase(chain));

    await qb.update(
      {
        table: "user_profiles",
        operation: "update",
        updateColumns: ["full_name"],
        filters: ["user_id"],
        requireFilter: true,
        returningColumns: ["id"],
        ownership: { column: "user_id", source: "authenticatedUserId", required: true },
      },
      {
        auth: { userId: "user-1" },
        data: { full_name: "Jane" },
      },
    );

    expect(chain.update).toHaveBeenCalledWith({ full_name: "Jane" });
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.select).toHaveBeenCalledWith("id");
  });

  it("rejects update without filters when required", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.update(
        {
          table: "levels",
          operation: "update",
          updateColumns: ["title"],
          filters: ["id"],
          requireFilter: true,
        },
        { data: { title: "Updated" } },
      ),
    ).rejects.toMatchObject({ code: "FILTER_REQUIRED" });
  });

  it("soft deletes through update and requires filters", async () => {
    const chain = createChain({ id: "level-1" });
    const qb = createQueryGateway(createSupabase(chain));

    await qb.delete(
      {
        table: "levels",
        operation: "delete",
        mode: "soft",
        filters: ["id"],
        requireFilter: true,
        softDeleteColumn: "is_active",
        softDeleteValue: false,
      },
      {
        filters: [{ column: "id", op: "eq", value: "level-1" }],
      },
    );

    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    expect(chain.eq).toHaveBeenCalledWith("id", "level-1");
  });

  it("rejects invalid in filter values", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.read(
        {
          table: "levels",
          operation: "read",
          columns: ["id"],
          filters: ["id"],
        },
        {
          filters: [{ column: "id", op: "in", value: "not-array" }],
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILTER_VALUE" });
  });

  it("throws database errors from Supabase", async () => {
    const qb = createQueryGateway(createSupabase(createChain(null, { message: "boom" })));

    await expect(
      qb.read({
        table: "levels",
        operation: "read",
        columns: ["id"],
      }),
    ).rejects.toBeInstanceOf(QueryGatewayDatabaseError);
  });

  it("calls allowed RPC functions with backend ownership arg", async () => {
    const chain = createChain();
    const supabase = createSupabase(chain);
    const qb = createQueryGateway(supabase);

    await qb.rpc(
      {
        operation: "rpc",
        functionName: "mark_xp_events_shown",
        allowedArgs: ["p_event_ids"],
        ownership: { arg: "p_user_id", source: "authenticatedUserId", required: true },
      },
      {
        auth: { userId: "user-1" },
        args: { p_event_ids: ["evt-1"] },
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith("mark_xp_events_shown", {
      p_event_ids: ["evt-1"],
      p_user_id: "user-1",
    });
  });

  it("rejects request-controlled RPC ownership args", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.rpc(
        {
          operation: "rpc",
          functionName: "mark_xp_events_shown",
          allowedArgs: ["p_event_ids"],
          ownership: { arg: "p_user_id", source: "authenticatedUserId", required: true },
        },
        {
          auth: { userId: "user-1" },
          args: { p_event_ids: ["evt-1"], p_user_id: "user-2" },
        },
      ),
    ).rejects.toMatchObject({ code: "OWNERSHIP_ARG_NOT_ALLOWED" });
  });

  it("rejects disallowed RPC args", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.rpc(
        {
          operation: "rpc",
          functionName: "mark_xp_events_shown",
          allowedArgs: ["p_event_ids"],
        },
        {
          args: { p_event_ids: ["evt-1"], p_extra: true },
        },
      ),
    ).rejects.toMatchObject({ code: "ARG_NOT_ALLOWED" });
  });

  it("rejects RPC calls with missing required auth user", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.rpc(
        {
          operation: "rpc",
          functionName: "mark_xp_events_shown",
          allowedArgs: ["p_event_ids"],
          ownership: { arg: "p_user_id", source: "authenticatedUserId", required: true },
        },
        { args: { p_event_ids: ["evt-1"] } },
      ),
    ).rejects.toMatchObject({ code: "AUTH_USER_REQUIRED" });
  });

  it("exposes gateway validation errors as QueryGatewayError", async () => {
    const qb = createQueryGateway(createSupabase(createChain()));

    await expect(
      qb.insert(
        {
          table: "levels",
          operation: "insert",
          insertColumns: ["title"],
        },
        { status: "published" },
      ),
    ).rejects.toBeInstanceOf(QueryGatewayError);
  });
});
