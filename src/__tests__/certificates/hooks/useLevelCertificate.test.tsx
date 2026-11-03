import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLevelCertificate } from "@/entities/certificate";
import { apiFetch } from "@/shared/api";
import { certificate, wrapper } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));
it("prefers the active certificate over revoked history and scopes to the level", async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    certificates: [{ ...certificate, status: "revoked" }, certificate],
  });
  const view = renderHook(() => useLevelCertificate("user", certificate.levelId!), { wrapper });
  await waitFor(() => expect(view.result.current.certificate?.status).toBe("issued"));
  expect(apiFetch).toHaveBeenCalledWith(
    `/api/v1/certificates?levelId=${certificate.levelId}`,
    expect.anything(),
  );
});
it("reconciles delayed issuance, then stops polling as soon as a certificate exists", async () => {
  vi.useFakeTimers();
  vi.mocked(apiFetch)
    .mockReset()
    .mockResolvedValueOnce({ certificates: [] })
    .mockResolvedValue({ certificates: [certificate] });
  const view = renderHook(() => useLevelCertificate("user", certificate.levelId!), { wrapper });
  try {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(view.result.current.certificate).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_001);
    });
    expect(view.result.current.certificate?.credentialId).toBe(certificate.credentialId);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
it("bounds automatic reconciliation and leaves manual recovery available", async () => {
  vi.useFakeTimers();
  vi.mocked(apiFetch).mockReset().mockResolvedValue({ certificates: [] });
  const view = renderHook(() => useLevelCertificate("user", certificate.levelId!), { wrapper });
  try {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(6);
    vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
    await act(async () => {
      await view.result.current.refetch();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(view.result.current.certificate?.status).toBe("issued");
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});
it("stops polling on errors and does not request a certificate without a session", async () => {
  vi.useFakeTimers();
  vi.mocked(apiFetch).mockReset().mockRejectedValue(new Error("Network"));
  const view = renderHook(() => useLevelCertificate("user", certificate.levelId!), { wrapper });
  try {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(view.result.current.isError).toBe(true);
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
  vi.mocked(apiFetch).mockClear();
  const signedOut = renderHook(() => useLevelCertificate(undefined, certificate.levelId!), {
    wrapper,
  });
  expect(signedOut.result.current.fetchStatus).toBe("idle");
  expect(apiFetch).not.toHaveBeenCalled();
});
