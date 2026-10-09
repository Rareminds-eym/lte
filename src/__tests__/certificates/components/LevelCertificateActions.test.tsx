import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LevelCertificateActions } from "@/features/certificate-actions";
import { apiFetch } from "@/shared/api";
import { certificate, wrapper } from "../testSupport";

vi.mock("@/shared/api", async (original) => ({
  ...(await original<typeof import("@/shared/api")>()),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));
vi.mock("@/entities/session", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: "user" } }),
}));
it.each([
  "pending_name",
  "revoked",
  "issued",
])("renders distinct certificate status %s", async (status) => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [{ ...certificate, status }] });
  render(<LevelCertificateActions levelId={certificate.levelId!} />, { wrapper });
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
it("separates operational failure from a valid empty result", async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error("Network"));
  const view = render(<LevelCertificateActions levelId={certificate.levelId!} />, { wrapper });
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your certificate");
  expect(screen.queryByText(/No certificate is available/)).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [] });
  render(<LevelCertificateActions levelId={certificate.levelId!} />, { wrapper });
  expect(
    await screen.findByText("No certificate is available for this level yet."),
  ).toBeInTheDocument();
});
it("shows the recorded certificate with verification and download actions", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ certificates: [certificate] });
  render(<LevelCertificateActions levelId={certificate.levelId!} />, { wrapper });
  expect(await screen.findByRole("article", { name: "Certificate preview" })).toHaveTextContent(
    "Ada Lovelace",
  );
  expect(screen.getByRole("link", { name: "Verify certificate" })).toHaveAttribute(
    "href",
    certificate.verifyUrl,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Your certificate is ready");
});
it("respects the server's download permission", async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    certificates: [{ ...certificate, downloadable: false }],
  });
  render(<LevelCertificateActions levelId={certificate.levelId!} />, { wrapper });
  expect(await screen.findByText(/PDF download is temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Download certificate" })).not.toBeInTheDocument();
});
