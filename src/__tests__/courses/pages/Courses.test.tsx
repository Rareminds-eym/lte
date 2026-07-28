import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Courses } from "@/pages/courses";

vi.mock("@/entities/course", () => ({
  CourseCard: ({ course }: { course: { title: string } }) => (
    <div data-testid="course-card">{course.title}</div>
  ),
}));

describe("Courses", () => {
  const renderCourses = () =>
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );

  it("renders page title and description", () => {
    renderCourses();
    expect(screen.getByText("My Courses")).toBeInTheDocument();
    expect(
      screen.getByText("Track your enrolled courses and continue where you left off."),
    ).toBeInTheDocument();
  });

  it("renders role tabs", () => {
    renderCourses();
    expect(screen.getByText("All Roles")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("shows 6 course cards on page 1 (PAGE_SIZE)", () => {
    renderCourses();
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(6);
  });

  it("paginates to page 2 showing remaining courses", () => {
    renderCourses();
    fireEvent.click(screen.getByLabelText("Next page"));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(2);
  });

  it("shows 5 backend courses after filtering", () => {
    renderCourses();
    fireEvent.click(screen.getByText("Backend Engineer"));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(5);
  });

  it("shows 3 frontend courses after filtering", () => {
    renderCourses();
    fireEvent.click(screen.getByText("Frontend Engineer"));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(3);
  });

  it("resets to page 1 when filtering by role", () => {
    renderCourses();
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getAllByTestId("course-card").length).toBe(2);
    fireEvent.click(screen.getByText("Backend Engineer"));
    expect(screen.getAllByTestId("course-card").length).toBe(5);
  });

  it("updates course count text when filtering", () => {
    renderCourses();
    expect(screen.getByText("8 courses")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Frontend Engineer"));
    expect(screen.getByText("3 courses")).toBeInTheDocument();
  });

  it("shows Filter button", () => {
    renderCourses();
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("disables previous page button on first page", () => {
    renderCourses();
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("shows total enrolled count in stats pills", () => {
    renderCourses();
    expect(screen.getByText("8 Enrolled")).toBeInTheDocument();
  });
});
