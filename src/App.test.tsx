import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "@/app/App";

vi.mock("@/app/providers/AppProviders", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-providers">{children}</div>
  ),
}));

vi.mock("@/app/router/AppRouter", () => ({
  AppRouter: () => <div data-testid="app-router" />,
}));

describe("App", () => {
  it("renders AppProviders and AppRouter inside Router", () => {
    render(<App />);
    expect(screen.getByTestId("app-providers")).toBeInTheDocument();
    expect(screen.getByTestId("app-router")).toBeInTheDocument();
  });
});
