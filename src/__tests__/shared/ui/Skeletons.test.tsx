import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CourseCardGridSkeleton,
  CourseCardSkeleton,
} from "@/entities/course/ui/CourseCardSkeleton";
import { CourseDetailSkeleton } from "@/pages/course-detail/ui/CourseDetailSkeleton";
import { InlineSpinner } from "@/shared/ui/inline-spinner/InlineSpinner";

describe("Static Skeletons and Spinners", () => {
  it("renders CourseCardSkeleton correctly", () => {
    const { container } = render(<CourseCardSkeleton />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders CourseCardGridSkeleton correctly", () => {
    const { container } = render(<CourseCardGridSkeleton count={3} />);
    // Grid itself is not .animate-pulse, but its children cards are
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders CourseDetailSkeleton correctly", () => {
    const { container } = render(<CourseDetailSkeleton />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders InlineSpinner correctly", () => {
    const { getByRole } = render(<InlineSpinner />);
    expect(getByRole("status")).toBeDefined();
  });
});
