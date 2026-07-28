import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseDetail } from "@/pages/course-detail";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ capabilityCode: "TEST-CAP-101" }),
    useLocation: () => ({ state: null }),
  };
});

vi.mock("@/features/initialize-learning-path", () => ({
  LearningPathInitializer: () => <div data-testid="learning-path-initializer" />,
}));

describe("CourseDetail", () => {
  it("renders heading and capability code", () => {
    render(<CourseDetail />);
    expect(screen.getByText("Course Details")).toBeInTheDocument();
    expect(screen.getByText("TEST-CAP-101")).toBeInTheDocument();
  });
});
