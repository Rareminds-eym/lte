import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CertificatePreview } from "@/entities/certificate";
import { certificate } from "../testSupport";

it("displays the issued snapshot as an accessible certificate document", () => {
  render(<CertificatePreview certificate={certificate} />);
  expect(screen.getByRole("article", { name: "Certificate preview" })).toBeInTheDocument();
  expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: certificate.title })).toBeInTheDocument();
  expect(screen.getByText(certificate.credentialId)).toBeInTheDocument();
  expect(document.querySelector("time")).toHaveAttribute("dateTime", certificate.completionDate);
});
it.each([
  "pending_name",
  "revoked",
] as const)("does not present %s as an earned document", (status) => {
  render(<CertificatePreview certificate={{ ...certificate, status }} />);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
it("never substitutes a current profile name for a missing recorded name", () => {
  render(<CertificatePreview certificate={{ ...certificate, learnerName: undefined }} />);
  expect(screen.queryByText("Awarded to")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: certificate.title })).toBeInTheDocument();
});
