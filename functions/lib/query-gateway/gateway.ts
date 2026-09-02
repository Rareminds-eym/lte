import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryGatewayDatabaseError, QueryGatewayError } from "./errors";
import { applyFilters, assertAllowedColumn } from "./filters";
import { applyPagination } from "./pagination";
import { pickAllowedPayload } from "./sanitize";
import type {
  QueryGatewayAuth,
  QueryGatewayDeleteOptions,
  QueryGatewayDeletePolicy,
  QueryGatewayFilter,
  QueryGatewayInsertOptions,
  QueryGatewayInsertPolicy,
  QueryGatewayReadOptions,
  QueryGatewayReadPolicy,
  QueryGatewayRpcOptions,
  QueryGatewayRpcPolicy,
  QueryGatewaySort,
  QueryGatewayUpdateOptions,
  QueryGatewayUpdatePolicy,
  QueryGatewayUpsertOptions,
  QueryGatewayUpsertPolicy,
  SupabaseGatewayClient,
  SupabaseQueryChain,
  SupabaseQueryResult,
} from "./types";

function asGatewayClient(supabase: SupabaseClient): SupabaseGatewayClient {
  return supabase as unknown as SupabaseGatewayClient;
}

function selectFor(columns?: readonly string[], select?: string): string {
  if (select) {
    if (select.trim() === "*") {
      throw new QueryGatewayError('select("*") is not allowed', "SELECT_ALL_NOT_ALLOWED");
    }
    return select;
  }

  if (!columns || columns.length === 0) {
    throw new QueryGatewayError("Read policy must define columns or select", "SELECT_REQUIRED");
  }

  return columns.join(",");
}

function returningSelect(columns?: readonly string[]): string | undefined {
  return columns && columns.length > 0 ? columns.join(",") : undefined;
}

function ownershipFilter(
  policy: { ownership?: { column: string; required: boolean } },
  auth?: QueryGatewayAuth,
): QueryGatewayFilter | null {
  if (!policy.ownership) {
    return null;
  }

  if (policy.ownership.required && !auth?.userId) {
    throw new QueryGatewayError("Authenticated user id is required", "AUTH_USER_REQUIRED", 401);
  }

  return auth?.userId ? { column: policy.ownership.column, op: "eq", value: auth.userId } : null;
}

function ownershipArg(
  policy: { ownership?: { arg: string; required: boolean } },
  auth?: QueryGatewayAuth,
): Record<string, unknown> {
  if (!policy.ownership) {
    return {};
  }

  if (policy.ownership.required && !auth?.userId) {
    throw new QueryGatewayError("Authenticated user id is required", "AUTH_USER_REQUIRED", 401);
  }

  return auth?.userId ? { [policy.ownership.arg]: auth.userId } : {};
}

function rejectRequestOwnedFilters(
  filters: readonly QueryGatewayFilter[] | undefined,
  ownershipColumn: string | undefined,
): void {
  if (!ownershipColumn) return;
  if (filters?.some((filter) => filter.column === ownershipColumn)) {
    throw new QueryGatewayError(
      `Request filters cannot provide ownership column: ${ownershipColumn}`,
      "OWNERSHIP_FILTER_NOT_ALLOWED",
    );
  }
}

function ensureFiltersPresent(filters: readonly QueryGatewayFilter[], context: string): void {
  if (filters.length === 0) {
    throw new QueryGatewayError(`${context} requires at least one filter`, "FILTER_REQUIRED");
  }
}

function validateFilters(
  filters: readonly QueryGatewayFilter[],
  allowedColumns: readonly string[] | undefined,
): void {
  const allowedOps = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "ilike"] as const;
  for (const filter of filters) {
    assertAllowedColumn(filter.column, allowedColumns, "Filter");
    if (!(allowedOps as readonly string[]).includes(filter.op)) {
      throw new QueryGatewayError(`Operator not allowed: ${filter.op}`, "OPERATOR_NOT_ALLOWED");
    }
  }
}

function validateSorts(
  sorts: readonly QueryGatewaySort[] | undefined,
  allowedColumns: readonly string[] | undefined,
): void {
  for (const sort of sorts ?? []) {
    assertAllowedColumn(sort.column, allowedColumns, "Sort");
  }
}

function applySorts<T>(
  query: SupabaseQueryChain<T>,
  sorts: readonly QueryGatewaySort[] | undefined,
): SupabaseQueryChain<T> {
  return (sorts ?? []).reduce<SupabaseQueryChain<T>>(
    (currentQuery, sort) => currentQuery.order(sort.column, { ascending: sort.ascending ?? true }),
    query,
  );
}

async function resolveResult<T>(query: SupabaseQueryChain<T>): Promise<T | null> {
  const result: SupabaseQueryResult<T> = await query;
  if (result.error) {
    throw new QueryGatewayDatabaseError(result.error.message, result.error);
  }
  return result.data;
}

async function resolveRpcResult(query: PromiseLike<SupabaseQueryResult>): Promise<unknown> {
  const result = await query;
  if (result.error) {
    throw new QueryGatewayDatabaseError(result.error.message, result.error);
  }
  return result.data;
}

function buildRpcQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayRpcPolicy,
  options: QueryGatewayRpcOptions = {},
) {
  const args = options.args ?? {};
  const rpcArgs: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (key === policy.ownership?.arg) {
      throw new QueryGatewayError(
        `Request args cannot provide ownership arg: ${key}`,
        "OWNERSHIP_ARG_NOT_ALLOWED",
      );
    }

    if (!policy.allowedArgs.includes(key)) {
      throw new QueryGatewayError(`RPC arg not allowed: ${key}`, "ARG_NOT_ALLOWED");
    }

    rpcArgs[key] = value;
  }

  return client.rpc(policy.functionName, {
    ...rpcArgs,
    ...ownershipArg(policy, options.auth),
  });
}

function buildReadQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayReadPolicy,
  options: QueryGatewayReadOptions = {},
): SupabaseQueryChain {
  const ownedFilter = ownershipFilter(policy, options.auth);
  rejectRequestOwnedFilters(options.filters, policy.ownership?.column);

  const requestFilters = options.filters ?? [];
  const notFilters = options.not ?? [];
  const filters = [
    ...(policy.defaultFilters ?? []),
    ...requestFilters,
    ...(ownedFilter ? [ownedFilter] : []),
  ];

  validateFilters(filters, policy.filters);
  validateFilters(notFilters, policy.filters);
  validateSorts(options.sort, policy.sorts);

  const selectedColumns = selectFor(policy.columns, policy.select);
  let query = client.from(policy.table).select(selectedColumns);
  query = applyFilters(query, filters);
  for (const filter of notFilters) {
    query = query.not(filter.column, filter.op, filter.value);
  }
  query = applySorts(query, options.sort);
  query = applyPagination(query, {
    page: options.page,
    pageSize: options.pageSize,
    maxPageSize: policy.maxPageSize,
  });

  if (options.limit !== undefined) {
    query = query.limit(Math.min(Math.max(options.limit, 1), 100));
  }

  if (options.result === "single") {
    return query.single();
  }

  if (options.result === "maybeSingle") {
    return query.maybeSingle();
  }

  return query;
}

function buildInsertQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayInsertPolicy,
  payload: Record<string, unknown>,
  options: QueryGatewayInsertOptions = {},
): SupabaseQueryChain {
  const ownedFilter = ownershipFilter(policy, options.auth);
  const sanitized = pickAllowedPayload(
    payload,
    policy.insertColumns,
    "Insert",
    policy.ownership?.column,
  );

  if (ownedFilter) {
    sanitized[ownedFilter.column] = ownedFilter.value;
  }

  const returning = returningSelect(policy.returningColumns);
  let query = client.from(policy.table).insert(sanitized);
  if (returning) {
    query = query.select(returning);
  }
  if (options.result === "single") {
    return query.single();
  }
  if (options.result === "maybeSingle") {
    return query.maybeSingle();
  }
  return query;
}

function buildUpsertQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayUpsertPolicy,
  payload: Record<string, unknown> | readonly Record<string, unknown>[],
  options: QueryGatewayUpsertOptions = {},
): SupabaseQueryChain {
  const ownedFilter = ownershipFilter(policy, options.auth);
  const rows = Array.isArray(payload) ? payload : [payload];
  const sanitizedRows = rows.map((row) => {
    const sanitized = pickAllowedPayload(
      row,
      policy.upsertColumns,
      "Upsert",
      policy.ownership?.column,
    );

    if (ownedFilter) {
      sanitized[ownedFilter.column] = ownedFilter.value;
    }

    return sanitized;
  });

  const returning = returningSelect(policy.returningColumns);
  const upsertPayload = Array.isArray(payload) ? sanitizedRows : sanitizedRows[0];
  if (!upsertPayload) {
    throw new QueryGatewayError("Upsert payload cannot be empty", "QUERY_GATEWAY_EMPTY_PAYLOAD");
  }
  let query = client.from(policy.table).upsert(upsertPayload, {
    onConflict: policy.onConflict,
  });
  if (returning) {
    query = query.select(returning);
  }
  if (options.result === "single") {
    return query.single();
  }
  if (options.result === "maybeSingle") {
    return query.maybeSingle();
  }
  return query;
}

function buildUpdateQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayUpdatePolicy,
  options: QueryGatewayUpdateOptions,
): SupabaseQueryChain {
  const ownedFilter = ownershipFilter(policy, options.auth);
  rejectRequestOwnedFilters(options.filters, policy.ownership?.column);

  const filters = [...(options.filters ?? []), ...(ownedFilter ? [ownedFilter] : [])];
  if (policy.requireFilter) {
    ensureFiltersPresent(filters, "Update");
  }
  validateFilters(filters, policy.filters);

  const sanitized = pickAllowedPayload(
    options.data,
    policy.updateColumns,
    "Update",
    policy.ownership?.column,
  );
  const returning = returningSelect(policy.returningColumns);
  let query = client.from(policy.table).update(sanitized);
  query = applyFilters(query, filters);
  if (returning) {
    query = query.select(returning);
  }
  return query;
}

function buildDeleteQuery(
  client: SupabaseGatewayClient,
  policy: QueryGatewayDeletePolicy,
  options: QueryGatewayDeleteOptions = {},
): SupabaseQueryChain {
  const ownedFilter = ownershipFilter(policy, options.auth);
  rejectRequestOwnedFilters(options.filters, policy.ownership?.column);

  const filters = [...(options.filters ?? []), ...(ownedFilter ? [ownedFilter] : [])];
  if (policy.requireFilter) {
    ensureFiltersPresent(filters, "Delete");
  }
  validateFilters(filters, policy.filters);

  const returning = returningSelect(policy.returningColumns);
  const query =
    policy.mode === "soft"
      ? client.from(policy.table).update({
          [policy.softDeleteColumn ?? "is_active"]: policy.softDeleteValue ?? false,
        })
      : client.from(policy.table).delete();

  const filteredQuery = applyFilters(query, filters);
  return returning ? filteredQuery.select(returning) : filteredQuery;
}

export type QueryGateway = ReturnType<typeof createQueryGateway>;
export type QueryGatewaySource = SupabaseClient | QueryGateway;

export function isQueryGateway(source: QueryGatewaySource): source is QueryGateway {
  return (
    typeof (source as QueryGateway).read === "function" &&
    typeof (source as QueryGateway).insert === "function" &&
    typeof (source as QueryGateway).update === "function" &&
    typeof (source as QueryGateway).upsert === "function" &&
    typeof (source as QueryGateway).delete === "function" &&
    typeof (source as QueryGateway).rpc === "function"
  );
}

export function asQueryGateway(source: QueryGatewaySource): QueryGateway {
  return isQueryGateway(source) ? source : createQueryGateway(source);
}

export function createQueryGateway(supabase: SupabaseClient) {
  const client = asGatewayClient(supabase);

  return {
    async read(
      policy: QueryGatewayReadPolicy,
      options?: QueryGatewayReadOptions,
    ): Promise<unknown> {
      return resolveResult(buildReadQuery(client, policy, options));
    },

    async insert(
      policy: QueryGatewayInsertPolicy,
      payload: Record<string, unknown>,
      options?: QueryGatewayInsertOptions,
    ): Promise<unknown> {
      return resolveResult(buildInsertQuery(client, policy, payload, options));
    },

    async update(
      policy: QueryGatewayUpdatePolicy,
      options: QueryGatewayUpdateOptions,
    ): Promise<unknown> {
      return resolveResult(buildUpdateQuery(client, policy, options));
    },

    async upsert(
      policy: QueryGatewayUpsertPolicy,
      payload: Record<string, unknown> | readonly Record<string, unknown>[],
      options?: QueryGatewayUpsertOptions,
    ): Promise<unknown> {
      return resolveResult(buildUpsertQuery(client, policy, payload, options));
    },

    async delete(
      policy: QueryGatewayDeletePolicy,
      options?: QueryGatewayDeleteOptions,
    ): Promise<unknown> {
      return resolveResult(buildDeleteQuery(client, policy, options));
    },

    async rpc(policy: QueryGatewayRpcPolicy, options?: QueryGatewayRpcOptions): Promise<unknown> {
      return resolveRpcResult(buildRpcQuery(client, policy, options));
    },
  };
}
