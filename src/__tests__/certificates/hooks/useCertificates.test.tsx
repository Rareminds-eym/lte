import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCertificates } from "@/entities/certificate";
import { apiFetch } from "@/shared/api";
import { certificate, wrapper } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("loads remote state via Query and does not fetch for logged-out users", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
  const loaded = renderHook(() => useCertificates("user"), { wrapper });
  await waitFor(() => expect(loaded.result.current.data).toEqual([certificate]));
  vi.clearAllMocks();
  const disabled = renderHook(() => useCertificates(undefined), { wrapper });
  expect(disabled.result.current.fetchStatus).toBe("idle");
  expect(apiFetch).not.toHaveBeenCalled();
});
it("partitions authenticated cache keys so changing users causes a new request", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
  const view = renderHook(({ id }) => useCertificates(id), {
    initialProps: { id: "first" },
    wrapper,
  });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  view.rerender({ id: "second" });
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
});
