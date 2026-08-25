import { QueryGatewayDatabaseError, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { vi } from "vitest";

export const mockSingle = vi.fn();
export const mockMaybeSingle = vi.fn();
export const mockLimit = vi.fn();
export const mockEq = vi.fn();
export const mockIn = vi.fn();
export const mockSelect = vi.fn();
export const mockUpdate = vi.fn();
export const mockInsert = vi.fn();
export const mockOrder = vi.fn();
export const mockGte = vi.fn();
export const mockRead = vi.fn();

interface XpMockChain {
  select: (...args: unknown[]) => unknown;
  update: (...args: unknown[]) => unknown;
  insert: (...args: unknown[]) => unknown;
  upsert?: (...args: unknown[]) => unknown;
  eq: (...args: unknown[]) => unknown;
  in: (...args: unknown[]) => unknown;
  limit: (...args: unknown[]) => unknown;
  maybeSingle: (...args: unknown[]) => unknown;
  single: (...args: unknown[]) => unknown;
  order: (...args: unknown[]) => unknown;
  gte?: (...args: unknown[]) => unknown;
  then?: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

export function createMockQueryChain(resolveVal: unknown, errorVal: unknown = null): XpMockChain {
  const chain: XpMockChain = {
    select: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    order: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: resolveVal, error: errorVal }).then(resolve),
  };
  return chain;
}

export function createChain(): XpMockChain {
  const chain: XpMockChain = {
    select: (...args: unknown[]) => mockSelect(...args) ?? chain,
    update: (...args: unknown[]) => mockUpdate(...args) ?? chain,
    insert: mockInsert,
    eq: (...args: unknown[]) => mockEq(...args) ?? chain,
    in: (...args: unknown[]) => mockIn(...args) ?? chain,
    limit: (...args: unknown[]) => mockLimit(...args) ?? chain,
    order: (...args: unknown[]) => mockOrder(...args) ?? chain,
    gte: (...args: unknown[]) => mockGte(...args) ?? chain,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };
  return chain;
}

export const mockSupabase = {
  read: vi.fn().mockImplementation(async (_policy: unknown, options?: { result?: string }) => {
    const result =
      options?.result === "maybeSingle"
        ? await mockMaybeSingle()
        : options?.result === "single"
          ? await mockSingle()
          : mockRead();
    if (result?.error) {
      throw new QueryGatewayDatabaseError(result.error.message, result.error);
    }
    if (result && typeof result === "object" && "data" in result) {
      return result.data ?? null;
    }
    return result ?? null;
  }),
  insert: vi
    .fn()
    .mockImplementation(
      async (
        policy: { ownership?: { column: string } },
        payload: Record<string, unknown>,
        options?: { auth?: { userId?: string } },
      ) => {
        const insertPayload = { ...payload };
        if (policy.ownership && options?.auth?.userId) {
          insertPayload[policy.ownership.column] = options.auth.userId;
        }
        const result = mockInsert(insertPayload);
        if (result?.error) {
          throw new QueryGatewayDatabaseError(result.error.message, result.error);
        }
        return result?.data ?? null;
      },
    ),
  update: vi.fn().mockImplementation(async (_policy: unknown, options: { data?: unknown }) => {
    const result = mockUpdate(options?.data);
    if (result?.error) {
      throw new QueryGatewayDatabaseError(result.error.message, result.error);
    }
    return result?.data ?? null;
  }),
  upsert: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(null),
  rpc: vi.fn().mockResolvedValue(null),
} as unknown as QueryGatewaySource;

export function resetMocks(): void {
  vi.clearAllMocks();
  mockRead.mockReturnValue({ data: null, error: null });
  mockInsert.mockReturnValue({ error: null });
  mockUpdate.mockReturnValue(null);
}
