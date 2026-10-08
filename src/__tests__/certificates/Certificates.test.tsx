import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  certificateSchema,
  fetchCertificates,
  useCertificates,
  useLevelCertificate,
} from "@/entities/certificate";
import {
  CopyVerifyLinkButton,
  DownloadCertificateButton,
  LevelCertificateActions,
} from "@/features/certificate-actions";
import { CertificatesPage } from "@/pages/certificates";
import { ApiError } from "@/shared/api/ApiError";
import { apiFetch, apiFetchBlob } from "@/shared/api/client";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn(), apiFetchBlob: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/entities/session", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: "user" } }),
}));
const certificate = {
  credentialId: "LTE-0123456789ABCDEF",
  certificateType: "course_completion",
  status: "issued",
  title: "Problem solving",
  subtitle: "Engineering",
  levelLabel: "Level 1",
  badge: "skilled",
  completionDate: "2026-10-08T00:00:00Z",
  issuedAt: "2026-10-08T00:00:00Z",
  levelId: "22222222-2222-4222-8222-222222222222",
  roleId: null,
  verifyUrl: "https://skillpassport.rareminds.in/verify/LTE-0123456789ABCDEF",
  downloadable: true,
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("validates API fixtures and filtered URLs", async () => {
  expect(certificateSchema.parse(certificate)).toEqual(certificate);
  await fetchCertificates({ type: "course_completion", levelId: certificate.levelId });
  expect(apiFetch).toHaveBeenCalledWith(
    `/api/v1/certificates?type=course_completion&levelId=${certificate.levelId}`,
    expect.anything(),
  );
});
it("hooks scope requests by user and find a level certificate", async () => {
  const { result } = renderHook(() => useLevelCertificate("user", certificate.levelId), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current.certificate?.credentialId).toBe(certificate.credentialId),
  );
  expect(apiFetch).toHaveBeenCalledWith(
    `/api/v1/certificates?levelId=${certificate.levelId}`,
    expect.anything(),
  );
  const disabled = renderHook(() => useCertificates(undefined), { wrapper });
  expect(disabled.result.current.fetchStatus).toBe("idle");
});
it("downloads a blob and releases its object URL", async () => {
  vi.mocked(apiFetchBlob).mockResolvedValue(new Blob(["%PDF-test"]));
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:certificate");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  render(<DownloadCertificateButton credentialId={certificate.credentialId} />);
  fireEvent.click(screen.getByRole("button", { name: "Download certificate" }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  expect(click).toHaveBeenCalledOnce();
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:certificate"), { timeout: 2000 });
  expect(toast.success).toHaveBeenCalledWith("Certificate downloaded");
});
it("shows a retry hint on renderer busy errors", async () => {
  vi.mocked(apiFetchBlob).mockRejectedValue(
    new ApiError("Busy", 503, "PDF_RENDER_BUSY", { retryAfterMs: 12000 }),
  );
  render(<DownloadCertificateButton credentialId={certificate.credentialId} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Please retry in 12 seconds."));
});
it("copies the API verification URL and handles clipboard failure", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CopyVerifyLinkButton verifyUrl={certificate.verifyUrl} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(writeText).toHaveBeenCalledWith(certificate.verifyUrl);
  writeText.mockRejectedValue(new Error());
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
});
it.each([
  "pending_name",
  "revoked",
  "issued",
])("renders level certificate status %s", async (status) => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [{ ...certificate, status }] });
  render(<LevelCertificateActions levelId={certificate.levelId} />, { wrapper });
  if (status === "pending_name")
    expect(await screen.findByRole("link", { name: /Add your name/ })).toHaveAttribute(
      "href",
      "/settings",
    );
  else if (status === "revoked")
    expect(await screen.findByText(/has been revoked/)).toBeInTheDocument();
  else
    expect(await screen.findByRole("button", { name: "Download certificate" })).toBeInTheDocument();
});
it("lists certificates and filters by type", async () => {
  render(<CertificatesPage />, { wrapper });
  expect(await screen.findByText("Problem solving")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "role_readiness" } });
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/certificates?type=role_readiness",
      expect.anything(),
    ),
  );
});
it("renders empty and error states", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [] });
  const view = render(<CertificatesPage />, { wrapper });
  expect(await screen.findByText("Your next achievement starts here")).toBeInTheDocument();
  view.unmount();
  vi.mocked(apiFetch).mockRejectedValue(new Error("Network"));
  render(<CertificatesPage />, { wrapper });
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load certificates");
});
