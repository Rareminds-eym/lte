import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CertificateCard } from "@/entities/certificate";
import { certificate, wrapper } from "../testSupport";

it("renders certificate facts and passed actions without owning an action", () => {
  render(
    <CertificateCard certificate={certificate} actions={<button type="button">Share</button>} />,
    { wrapper },
  );
  expect(screen.getByText(certificate.title)).toBeInTheDocument();
  expect(screen.getByText(certificate.credentialId)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
});
it("offers name recovery only for pending certificates", () => {
  render(<CertificateCard certificate={{ ...certificate, status: "pending_name" }} />, { wrapper });
  expect(screen.getByRole("link", { name: /Add your name/ })).toHaveAttribute("href", "/settings");
});
