import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { CertificatesPage } from "@/pages/certificates";
import { certificate } from "../testSupport";

vi.mock("@/pages/certificates/ui/CertificateCollection", () => ({
  CertificateCollection: () => <section aria-label="Certificate collection" />,
}));
vi.mock("@/features/certificate-actions", () => ({
  LevelCertificateActions: ({ levelId }: { levelId: string }) => (
    <div data-testid="level-certificate">{levelId}</div>
  ),
}));
it("composes the collection on its ordinary route", () => {
  render(
    <MemoryRouter>
      <CertificatesPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("region", { name: "Certificate collection" })).toBeInTheDocument();
});
it("opens the focused certificate from a reloadable completion link", () => {
  render(
    <MemoryRouter initialEntries={[`/certificates?levelId=${certificate.levelId}`]}>
      <CertificatesPage />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("level-certificate")).toHaveTextContent(certificate.levelId!);
  expect(screen.getByRole("link", { name: "View all certificates" })).toHaveAttribute(
    "href",
    "/certificates",
  );
  expect(screen.getByRole("link", { name: "Back to my courses" })).toHaveAttribute(
    "href",
    "/my-courses",
  );
  expect(screen.queryByRole("region", { name: "Certificate collection" })).not.toBeInTheDocument();
});
it.each(["bad-id", ""])("validates the route before requesting certificate data: %s", (id) => {
  render(
    <MemoryRouter initialEntries={[`/certificates?levelId=${id}`]}>
      <CertificatesPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("This certificate link is invalid");
  expect(screen.queryByTestId("level-certificate")).not.toBeInTheDocument();
});
