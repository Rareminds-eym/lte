import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "@/shared/ui";

describe("ErrorFallback", () => {
  it("renders error message from Error instance", () => {
    render(<ErrorFallback error={new Error("Something broke")} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("renders fallback message for non-Error error", () => {
    render(<ErrorFallback error="string error" resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText("Unknown error")).toBeInTheDocument();
  });

  it("renders try again button", () => {
    render(<ErrorFallback error={new Error("test")} resetErrorBoundary={vi.fn()} />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("calls resetErrorBoundary on button click", () => {
    const reset = vi.fn();
    render(<ErrorFallback error={new Error("test")} resetErrorBoundary={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
