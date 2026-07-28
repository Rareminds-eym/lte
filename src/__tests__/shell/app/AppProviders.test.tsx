import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers/AppProviders";

describe("AppProviders", () => {
  it("renders children inside ErrorBoundary", () => {
    render(
      <AppProviders>
        <div data-testid="child" />
      </AppProviders>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders ErrorFallback when error is thrown", () => {
    const ThrowingComponent = () => {
      throw new Error("test error");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppProviders>
        <ThrowingComponent />
      </AppProviders>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    (console.error as unknown as ReturnType<typeof vi.spyOn>).mockRestore();
  });
});
