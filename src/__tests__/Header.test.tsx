import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/widgets/Header";

describe("Header", () => {
  it("renders search input", () => {
    render(<Header />);
    expect(screen.getByPlaceholderText("Search courses, skills, topics...")).toBeInTheDocument();
  });

  it("renders notifications button", () => {
    render(<Header />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it('shows "Learner" when no userName provided', () => {
    render(<Header />);
    expect(screen.getByText("Learner")).toBeInTheDocument();
  });

  it("shows userName when provided", () => {
    render(<Header userName="John Doe" />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows userStatus when provided", () => {
    render(<Header userName="John" userStatus="L3" />);
    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  it("calls onSearch when input changes", () => {
    const onSearch = vi.fn();
    render(<Header onSearch={onSearch} />);
    const input = screen.getByPlaceholderText("Search courses, skills, topics...");
    fireEvent.change(input, { target: { value: "react" } });
    expect(onSearch).toHaveBeenCalledWith("react");
  });

  it("applies className to header element", () => {
    const { container } = render(<Header className="custom-header" />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("custom-header");
  });

  it("shows notification badge when notificationCount is provided", () => {
    render(<Header notificationCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not render badge for zero notifications", () => {
    render(<Header notificationCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("handles search input change when onSearch is not provided", () => {
    render(<Header />);
    const input = screen.getByPlaceholderText("Search courses, skills, topics...");
    fireEvent.change(input, { target: { value: "react" } });
    expect(input).toHaveValue("react");
  });
});
