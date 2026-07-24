import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import { NotFound } from "@/pages/NotFound";

describe("NotFound", () => {
  it("renders 404 heading", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText("404 - Page Not Found")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText("The page you are looking for does not exist.")).toBeInTheDocument();
  });

  it("renders go back button", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText("Go back to Dashboard")).toBeInTheDocument();
  });

  it("navigates to / on button click", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Go back to Dashboard"));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
