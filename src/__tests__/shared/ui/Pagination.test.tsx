import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/widgets";

describe("Pagination", () => {
  it("renders page numbers", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders Previous and Next buttons", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("disables Previous on first page", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("Prev")).toBeDisabled();
  });

  it("disables Next on last page", () => {
    render(<Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange when page is clicked", async () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={handlePageChange} />);
    await userEvent.click(screen.getByText("2"));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when Previous is clicked", async () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={3} onPageChange={handlePageChange} />);
    await userEvent.click(screen.getByText("Prev"));
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange when Next is clicked", async () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={handlePageChange} />);
    await userEvent.click(screen.getByText("Next"));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("returns null when totalPages <= 1", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("marks current page with aria-current", () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
  });

  it("marks page 1 with aria-current when currentPage is 1", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toHaveAttribute("aria-current", "page");
  });

  it("returns null when totalPages is 0", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("handles currentPage greater than totalPages gracefully", () => {
    render(<Pagination currentPage={5} totalPages={2} onPageChange={() => {}} />);
    expect(screen.getByText("1")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("2")).not.toHaveAttribute("aria-current");
  });

  it("does not call onPageChange when clicking disabled Previous on first page", async () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={handlePageChange} />);
    await userEvent.click(screen.getByText("Prev"));
    expect(handlePageChange).not.toHaveBeenCalled();
  });

  it("does not call onPageChange when clicking disabled Next on last page", async () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={3} onPageChange={handlePageChange} />);
    await userEvent.click(screen.getByText("Next"));
    expect(handlePageChange).not.toHaveBeenCalled();
  });
});
