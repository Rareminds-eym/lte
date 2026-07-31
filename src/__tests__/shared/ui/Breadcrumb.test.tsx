import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "@/shared/ui";

describe("Breadcrumb", () => {
  it("renders breadcrumb items correctly", () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Courses", href: "/my-courses" },
            { label: "React Fundamentals" },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
    expect(screen.getByText("React Fundamentals")).toBeInTheDocument();
  });

  it("handles onClick for button breadcrumb items", () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: "Overview", onClick }, { label: "Current Page" }]} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Overview"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
