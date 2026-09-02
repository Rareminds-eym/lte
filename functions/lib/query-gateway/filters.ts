import { QueryGatewayError } from "./errors";
import type { QueryGatewayFilter, SupabaseQueryChain } from "./types";

export function assertAllowedColumn(
  column: string,
  allowedColumns: readonly string[] | undefined,
  context: string,
): void {
  if (!allowedColumns?.includes(column)) {
    throw new QueryGatewayError(`${context} column not allowed: ${column}`, "COLUMN_NOT_ALLOWED");
  }
}

export function applyFilter<T>(
  query: SupabaseQueryChain<T>,
  filter: QueryGatewayFilter,
): SupabaseQueryChain<T> {
  switch (filter.op) {
    case "eq":
      return query.eq(filter.column, filter.value);
    case "neq":
      return query.neq(filter.column, filter.value);
    case "gt":
      return query.gt(filter.column, filter.value);
    case "gte":
      return query.gte(filter.column, filter.value);
    case "lt":
      return query.lt(filter.column, filter.value);
    case "lte":
      return query.lte(filter.column, filter.value);
    case "ilike":
      return query.ilike(filter.column, String(filter.value));
    case "in":
      if (!Array.isArray(filter.value)) {
        throw new QueryGatewayError(
          `Filter "${filter.column}" requires an array value`,
          "INVALID_FILTER_VALUE",
        );
      }
      return query.in(filter.column, filter.value);
    case "is":
      return query.is(filter.column, filter.value);
    default:
      throw new QueryGatewayError("Unsupported filter operator", "UNSUPPORTED_FILTER_OPERATOR");
  }
}

export function applyFilters<T>(
  query: SupabaseQueryChain<T>,
  filters: readonly QueryGatewayFilter[],
): SupabaseQueryChain<T> {
  return filters.reduce<SupabaseQueryChain<T>>(
    (currentQuery, filter) => applyFilter(currentQuery, filter),
    query,
  );
}
