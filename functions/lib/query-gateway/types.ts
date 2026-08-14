export type QueryGatewayOperation = "read" | "insert" | "update" | "delete" | "upsert" | "rpc";

export type QueryFilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "ilike";

export interface QueryGatewayAuth {
  userId?: string;
}

export interface QueryGatewayOwnership {
  column: string;
  source: "authenticatedUserId";
  required: boolean;
}

export interface QueryGatewayRpcOwnership {
  arg: string;
  source: "authenticatedUserId";
  required: boolean;
}

export interface QueryGatewayFilter {
  column: string;
  op: QueryFilterOperator;
  value: unknown;
}

export interface QueryGatewaySort {
  column: string;
  ascending?: boolean;
}

export interface QueryGatewayBasePolicy {
  table: string;
  operation: QueryGatewayOperation;
  ownership?: QueryGatewayOwnership;
}

export interface QueryGatewayReadPolicy extends QueryGatewayBasePolicy {
  operation: "read";
  columns?: readonly string[];
  select?: string;
  filters?: readonly string[];
  sorts?: readonly string[];
  defaultFilters?: readonly QueryGatewayFilter[];
  maxPageSize?: number;
}

export interface QueryGatewayInsertPolicy extends QueryGatewayBasePolicy {
  operation: "insert";
  insertColumns: readonly string[];
  returningColumns?: readonly string[];
}

export interface QueryGatewayUpsertPolicy extends QueryGatewayBasePolicy {
  operation: "upsert";
  upsertColumns: readonly string[];
  onConflict: string;
  returningColumns?: readonly string[];
}

export interface QueryGatewayUpdatePolicy extends QueryGatewayBasePolicy {
  operation: "update";
  updateColumns: readonly string[];
  filters: readonly string[];
  requireFilter: boolean;
  returningColumns?: readonly string[];
}

export interface QueryGatewayDeletePolicy extends QueryGatewayBasePolicy {
  operation: "delete";
  mode: "soft" | "hard";
  filters: readonly string[];
  requireFilter: boolean;
  softDeleteColumn?: string;
  softDeleteValue?: unknown;
  returningColumns?: readonly string[];
}

export interface QueryGatewayRpcPolicy {
  operation: "rpc";
  functionName: string;
  allowedArgs: readonly string[];
  ownership?: QueryGatewayRpcOwnership;
}

export type QueryGatewayPolicy =
  | QueryGatewayReadPolicy
  | QueryGatewayInsertPolicy
  | QueryGatewayUpsertPolicy
  | QueryGatewayUpdatePolicy
  | QueryGatewayDeletePolicy
  | QueryGatewayRpcPolicy;

export interface QueryGatewayReadOptions {
  auth?: QueryGatewayAuth;
  filters?: readonly QueryGatewayFilter[];
  sort?: readonly QueryGatewaySort[];
  not?: readonly QueryGatewayFilter[];
  page?: number;
  pageSize?: number;
  limit?: number;
  result?: "many" | "single" | "maybeSingle";
}

export interface QueryGatewayInsertOptions {
  auth?: QueryGatewayAuth;
  result?: "many" | "single" | "maybeSingle";
}

export interface QueryGatewayUpsertOptions {
  auth?: QueryGatewayAuth;
  result?: "many" | "single" | "maybeSingle";
}

export interface QueryGatewayUpdateOptions {
  auth?: QueryGatewayAuth;
  filters?: readonly QueryGatewayFilter[];
  data: Record<string, unknown>;
}

export interface QueryGatewayDeleteOptions {
  auth?: QueryGatewayAuth;
  filters?: readonly QueryGatewayFilter[];
}

export interface QueryGatewayRpcOptions {
  auth?: QueryGatewayAuth;
  args?: Record<string, unknown>;
}

export interface SupabaseQueryResult<T = unknown> {
  data: T | null;
  error: { code?: string; message: string } | null;
}

export interface SupabaseQueryChain<T = unknown> extends PromiseLike<SupabaseQueryResult<T>> {
  eq(column: string, value: unknown): SupabaseQueryChain<T>;
  neq(column: string, value: unknown): SupabaseQueryChain<T>;
  gt(column: string, value: unknown): SupabaseQueryChain<T>;
  gte(column: string, value: unknown): SupabaseQueryChain<T>;
  lt(column: string, value: unknown): SupabaseQueryChain<T>;
  lte(column: string, value: unknown): SupabaseQueryChain<T>;
  in(column: string, values: readonly unknown[]): SupabaseQueryChain<T>;
  ilike(column: string, pattern: string): SupabaseQueryChain<T>;
  order(column: string, options: { ascending: boolean }): SupabaseQueryChain<T>;
  range(from: number, to: number): SupabaseQueryChain<T>;
  limit(count: number): SupabaseQueryChain<T>;
  not(column: string, operator: string, value: unknown): SupabaseQueryChain<T>;
  select(columns?: string): SupabaseQueryChain<T>;
  single(): SupabaseQueryChain<T>;
  maybeSingle(): SupabaseQueryChain<T>;
  insert(payload: Record<string, unknown>): SupabaseQueryChain<T>;
  upsert(
    payload: Record<string, unknown> | readonly Record<string, unknown>[],
    options: { onConflict: string },
  ): SupabaseQueryChain<T>;
  update(payload: Record<string, unknown>): SupabaseQueryChain<T>;
  delete(): SupabaseQueryChain<T>;
}

export interface SupabaseGatewayClient {
  from(table: string): SupabaseQueryChain;
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<SupabaseQueryResult>;
}
