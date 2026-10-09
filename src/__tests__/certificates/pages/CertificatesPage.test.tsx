import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CertificatesPage } from "@/pages/certificates";

vi.mock("@/pages/certificates/ui/CertificateCollection", () => ({
  CertificateCollection: () => <section aria-label="Certificate collection" />,
}));
it("composes the certificate collection without owning its domain state", () => {
  render(<CertificatesPage />);
  expect(screen.getByRole("region", { name: "Certificate collection" })).toBeInTheDocument();
});
