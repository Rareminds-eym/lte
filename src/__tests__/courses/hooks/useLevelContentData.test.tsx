import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockFetchLevelDetails = vi.fn();
const mockFetchLevelModuleDetails = vi.fn();

vi.mock("@/entities/course/api", () => ({
  fetchLevelDetails: (...args: unknown[]) => mockFetchLevelDetails(...args),
  fetchLevelModuleDetails: (...args: unknown[]) => mockFetchLevelModuleDetails(...args),
}));

import {
  getLevelContentQueryKey,
  getLevelDetailsQueryKey,
  getLevelModuleDetailsQueryKey,
  useLevelContentData,
  useLevelDetails,
  useLevelModuleDetails,
} from "@/entities/course/model/useLevelContentData";

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useLevelContentData hooks", () => {
  it("useLevelContentData registers and fetches level content data", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockFetchLevelDetails.mockResolvedValue({ id: "lvl-1" });
    mockFetchLevelModuleDetails.mockResolvedValue({ id: "mod-1" });

    const { result } = renderHook(() => useLevelContentData("lvl-1", 1, "TS-101"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      level: { id: "lvl-1" },
      module: { id: "mod-1" },
    });
  });

  it("useLevelContentData queryFn throws when parameters are missing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Register the query by rendering the hook with undefined/missing params
    renderHook(() => useLevelContentData(undefined, undefined, undefined), {
      wrapper: createWrapper(queryClient),
    });

    // Manually run queryFn via fetchQuery
    await expect(
      queryClient.fetchQuery({
        queryKey: getLevelContentQueryKey(undefined, undefined, undefined),
      }),
    ).rejects.toThrow("Level id and module number are required.");
  });

  it("useLevelModuleDetails registers and fetches module details", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockFetchLevelModuleDetails.mockResolvedValue({ id: "mod-1" });

    const { result } = renderHook(() => useLevelModuleDetails("lvl-1", 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "mod-1" });
  });

  it("useLevelModuleDetails queryFn throws when parameters are missing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useLevelModuleDetails(undefined, undefined), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      queryClient.fetchQuery({
        queryKey: getLevelModuleDetailsQueryKey(undefined, undefined),
      }),
    ).rejects.toThrow("Level id and module number are required.");
  });

  it("useLevelDetails registers and fetches level details", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockFetchLevelDetails.mockResolvedValue({ id: "lvl-1" });

    const { result } = renderHook(() => useLevelDetails("lvl-1", "TS-101", "user-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "lvl-1" });
  });

  it("useLevelDetails queryFn throws when parameters are missing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useLevelDetails(undefined, undefined, undefined), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      queryClient.fetchQuery({
        queryKey: getLevelDetailsQueryKey(undefined, undefined),
      }),
    ).rejects.toThrow("Level id is required.");
  });
});
