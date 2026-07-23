import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Courses } from "@/pages/Courses";

describe("Courses", () => {
  it("renders page title", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("My Courses")).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Track your enrolled courses and continue where you left off."),
    ).toBeInTheDocument();
  });

  it("renders role tabs", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("All Roles")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Backend Engineer/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Frontend Engineer/ })).toBeInTheDocument();
  });

  it("renders stats pills", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("8 Enrolled")).toBeInTheDocument();
    expect(screen.getByText("2 Completed")).toBeInTheDocument();
    expect(screen.getByText("3 In Progress")).toBeInTheDocument();
  });

  it("renders Filter button", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("renders course count", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("8 courses")).toBeInTheDocument();
  });

  it("renders first page of course cards", () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("Observability Mastery")).toBeInTheDocument();
    expect(screen.getByText("React Performance")).toBeInTheDocument();
    // courses 7-8 are on page 2 (PAGE_SIZE=6)
    expect(screen.queryByText("TypeScript Advanced Patterns")).not.toBeInTheDocument();
  });

  it("navigates to page 2", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("TypeScript Advanced Patterns")).toBeInTheDocument();
  });

  it("filters courses when Backend Engineer tab is clicked", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("tab", { name: /Backend Engineer/ }));
    expect(screen.getByText("Observability Mastery")).toBeInTheDocument();
    expect(screen.queryByText("React Performance")).not.toBeInTheDocument();
    expect(screen.queryByText("TypeScript Advanced Patterns")).not.toBeInTheDocument();
  });

  it("filters courses when Frontend Engineer tab is clicked", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("tab", { name: /Frontend Engineer/ }));
    expect(screen.getByText("React Performance")).toBeInTheDocument();
    expect(screen.queryByText("Distributed Systems Design")).not.toBeInTheDocument();
  });

  it("resets to all courses when All Roles is clicked after filtering", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("tab", { name: /Frontend Engineer/ }));
    expect(screen.queryByText("Distributed Systems Design")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /All Roles/ }));
    expect(screen.getByText("Distributed Systems Design")).toBeInTheDocument();
    expect(screen.getByText("React Performance")).toBeInTheDocument();
  });

  it("updates course count when filtering by role", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByText("8 courses")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Backend Engineer/ }));
    expect(screen.getByText("5 courses")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Frontend Engineer/ }));
    expect(screen.getByText("3 courses")).toBeInTheDocument();
  });

  it("resets to page 1 when role filter reduces total pages below current page", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("TypeScript Advanced Patterns")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Backend Engineer/ }));
    expect(screen.getByText("Observability Mastery")).toBeInTheDocument();
    expect(screen.queryByText("TypeScript Advanced Patterns")).not.toBeInTheDocument();
  });

  it("disables Previous on first page and Next on last page", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("navigates back to page 1 when Previous is clicked", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("TypeScript Advanced Patterns")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(screen.getByText("Observability Mastery")).toBeInTheDocument();
    expect(screen.queryByText("TypeScript Advanced Patterns")).not.toBeInTheDocument();
  });

  it("navigates to page 2 when page number 2 is clicked", async () => {
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getByText("TypeScript Advanced Patterns")).toBeInTheDocument();
  });
});
