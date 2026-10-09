import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DownloadCertificateButton } from "@/features/certificate-actions";
import { ApiError, apiFetchBlob } from "@/shared/api";
import { toast } from "@/shared/ui";
import { certificate, wrapper } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetchBlob: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());
it("downloads a blob, removes the anchor, and releases its object URL", async () => {
  vi.mocked(apiFetchBlob).mockResolvedValue(new Blob(["%PDF-test"]));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:certificate");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  render(<DownloadCertificateButton credentialId={certificate.credentialId} />, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: "Download certificate" }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(document.querySelector("a[download]")).toBeNull();
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:certificate"), { timeout: 2000 });
  expect(toast.success).toHaveBeenCalledWith("Certificate downloaded");
});
it("preserves renderer retry hints and rejects malformed retry metadata", async () => {
  vi.mocked(apiFetchBlob).mockRejectedValue(
    new ApiError("Busy", 503, "PDF_RENDER_BUSY", { retryAfterMs: 12000 }),
  );
  render(<DownloadCertificateButton credentialId={certificate.credentialId} />, { wrapper });
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Please retry in 12 seconds."));
  vi.mocked(apiFetchBlob).mockRejectedValue(
    new ApiError("Busy", 503, "PDF_RENDER_BUSY", { retryAfterMs: "private data" }),
  );
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "Could not download your certificate. Please try again.",
    ),
  );
});
