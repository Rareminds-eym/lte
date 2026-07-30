import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationLoader } from "@/shared/ui/ApplicationLoader";

// Mock the shared Image component to avoid needing actual image loading in tests
vi.mock("@/shared/ui/Image", () => ({
  Image: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe("ApplicationLoader", () => {
  it("renders with data-testid='application-loader'", () => {
    render(<ApplicationLoader />);
    expect(screen.getByTestId("application-loader")).toBeInTheDocument();
  });

  it("has role='status' and aria-live='polite'", () => {
    render(<ApplicationLoader />);
    const el = screen.getByTestId("application-loader");
    expect(el).toHaveAttribute("role", "status");
    expect(el).toHaveAttribute("aria-live", "polite");
  });

  it("displays the default message 'Loading…'", () => {
    render(<ApplicationLoader />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("displays a custom message when provided", () => {
    render(<ApplicationLoader message="Verifying your session…" />);
    expect(screen.getByText("Verifying your session…")).toBeInTheDocument();
  });

  it("renders the Rareminds branding text", () => {
    render(<ApplicationLoader />);
    expect(screen.getByText("Rareminds")).toBeInTheDocument();
  });

  it("renders the branding logo image", () => {
    render(<ApplicationLoader />);
    expect(screen.getByAltText("Rareminds")).toBeInTheDocument();
  });
});
