import { describe, expect, it } from "vitest";
import {
  COURSE_PAGE_SIZE,
  filterCoursesByPriority,
  filterCoursesBySearch,
  getSafeCoursePage,
  paginateCourses,
} from "@/pages/courses";

const courses = Array.from({ length: COURSE_PAGE_SIZE + 2 }, (_, index) => ({
  id: `course-${index + 1}`,
  priority: index % 2 === 0 ? "Core" : "Supporting",
}));

describe("courseFilters", () => {
  it("combines case-insensitive search terms with the selected role", () => {
    const courses = [
      {
        id: "a",
        title: "API Design",
        description: "Reliable services",
        category: "Backend",
        tags: ["HTTP"],
        roleId: "r1",
        roleName: "Engineer",
      },
      {
        id: "b",
        title: "API Design",
        description: "Client integration",
        category: "Frontend",
        tags: ["React"],
        roleId: "r2",
        roleName: "Developer",
      },
    ] as Parameters<typeof filterCoursesBySearch>[0];
    expect(filterCoursesBySearch(courses, "api HTTP", "r1").map((course) => course.id)).toEqual([
      "a",
    ]);
    expect(filterCoursesBySearch(courses, "React", "r1")).toEqual([]);
    expect(filterCoursesBySearch(courses, "missing", null)).toEqual([]);
  });
  it("returns the original course list when no priority filter is selected", () => {
    expect(
      filterCoursesByPriority(
        courses as unknown as Parameters<typeof filterCoursesByPriority>[0],
        null,
      ),
    ).toBe(courses);
  });

  it("filters courses by priority", () => {
    expect(
      filterCoursesByPriority(
        courses as unknown as Parameters<typeof filterCoursesByPriority>[0],
        "Core",
      ).map((course) => course.id),
    ).toEqual(["course-1", "course-3", "course-5", "course-7"]);
  });

  it("clamps the current page to at least one and at most total pages", () => {
    expect(getSafeCoursePage(3, 2)).toBe(2);
    expect(getSafeCoursePage(0, 0)).toBe(0);
    expect(getSafeCoursePage(1, 0)).toBe(1);
  });

  it("returns the requested page of courses", () => {
    expect(
      paginateCourses(courses as unknown as Parameters<typeof paginateCourses>[0], 1).map(
        (course) => course.id,
      ),
    ).toEqual(["course-1", "course-2", "course-3", "course-4", "course-5", "course-6"]);
    expect(
      paginateCourses(courses as unknown as Parameters<typeof paginateCourses>[0], 2).map(
        (course) => course.id,
      ),
    ).toEqual(["course-7", "course-8"]);
  });
});
