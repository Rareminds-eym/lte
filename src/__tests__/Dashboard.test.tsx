import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/pages/Dashboard";

describe("Dashboard", () => {
  it("renders heading", () => {
    render(<Dashboard />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders welcome text", () => {
    render(<Dashboard />);
    expect(
      screen.getByText("Welcome to the LTE - Learner Transformer Engine!"),
    ).toBeInTheDocument();
  });
});
