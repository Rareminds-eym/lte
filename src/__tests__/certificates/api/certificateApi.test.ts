import { beforeEach, expect, it, vi } from "vitest";
import { downloadCertificate, fetchCertificates } from "@/entities/certificate";
import { apiFetch, apiFetchBlob } from "@/shared/api";
import { certificate } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
});
it("uses filtered, bounded requests and validates responses", async () => {
  expect(
    await fetchCertificates({ type: "course_completion", levelId: certificate.levelId! }),
  ).toEqual([certificate]);
  expect(apiFetch).toHaveBeenCalledWith(
    `/api/v1/certificates?type=course_completion&levelId=${certificate.levelId}`,
    { signal: expect.any(AbortSignal), headers: expect.any(Headers) },
  );
  vi.mocked(apiFetch).mockResolvedValueOnce({
    certificates: [{ ...certificate, credentialId: "bad" }],
  });
  await expect(fetchCertificates()).rejects.toThrow();
});
it("preserves cancellation and rejects malformed filters before I/O", async () => {
  const abort = new AbortController();
  abort.abort();
  await fetchCertificates({}, abort.signal);
  expect(vi.mocked(apiFetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  vi.clearAllMocks();
  await expect(fetchCertificates({ levelId: "bad" })).rejects.toThrow();
  expect(apiFetch).not.toHaveBeenCalled();
});
it("downloads through the approved binary client with a bounded signal", async () => {
  const blob = new Blob(["%PDF-test"]);
  vi.mocked(apiFetchBlob).mockResolvedValue(blob);
  expect(await downloadCertificate(certificate.credentialId)).toBe(blob);
  expect(apiFetchBlob).toHaveBeenCalledWith(
    `/api/v1/certificates/${certificate.credentialId}/download`,
    { signal: expect.any(AbortSignal), headers: expect.any(Headers) },
  );
});
