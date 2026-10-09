import { renderHook, waitFor } from "@testing-library/react";
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
