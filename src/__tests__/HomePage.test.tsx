import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders home text", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("renders link to dashboard", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const link = screen.getByText("Dashboard");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/dashboard");
  });
});
