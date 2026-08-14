import type { SupabaseClient } from "@supabase/supabase-js";
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
  from: vi.fn().mockImplementation(() => createChain()),
} as unknown as SupabaseClient;

export function resetMocks(): void {
  vi.clearAllMocks();
  mockInsert.mockReturnValue({ error: null });
  mockUpdate.mockReturnValue(null);
}
