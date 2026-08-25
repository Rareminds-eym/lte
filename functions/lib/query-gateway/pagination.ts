import type { SupabaseQueryChain } from "./types";

export function applyPagination<T>(
  query: SupabaseQueryChain<T>,
  options: { page?: number; pageSize?: number; maxPageSize?: number },
): SupabaseQueryChain<T> {
  if (options.page === undefined && options.pageSize === undefined) {
    return query;
  }

  const page = Math.max(options.page ?? 1, 1);
  const maxPageSize = options.maxPageSize ?? 50;
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), maxPageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return query.range(from, to);
}
