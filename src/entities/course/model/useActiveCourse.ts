import { useMemo } from "react";
import type { Course } from "./types";

export const useActiveCourse = (
  courses: Course[] | undefined,
  capabilitySlug?: string,
): Course | null => {
  return useMemo(() => {
    if (!courses || !capabilitySlug) return null;

    const slugLower = capabilitySlug.toLowerCase();

    // 1. Prioritized exact match on slug
    const slugMatch = courses.find((c) => c.slug && c.slug.toLowerCase() === slugLower);
    if (slugMatch) return slugMatch;

    // 2. Fallback matching on other identifiers (code, capabilityId, or id)
    return (
      courses.find(
        (c) =>
          c.capabilityCode.toLowerCase() === slugLower ||
          c.capabilityId === capabilitySlug ||
          c.id === capabilitySlug,
      ) ?? null
    );
  }, [courses, capabilitySlug]);
};
