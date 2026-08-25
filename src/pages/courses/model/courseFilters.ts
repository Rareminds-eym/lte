import type { Course } from "@/entities/course";

export const COURSE_PAGE_SIZE = 6;

export function filterCoursesByPriority(courses: Course[], priority: string | null): Course[] {
  return priority ? courses.filter((course) => course.priority === priority) : courses;
}

export function getSafeCoursePage(currentPage: number, totalPages: number): number {
  return Math.min(currentPage, Math.max(1, totalPages));
}

export function paginateCourses(courses: Course[], page: number): Course[] {
  const start = (page - 1) * COURSE_PAGE_SIZE;
  return courses.slice(start, start + COURSE_PAGE_SIZE);
}
