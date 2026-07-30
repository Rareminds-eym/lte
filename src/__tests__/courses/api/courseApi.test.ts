import { describe, expect, it, vi } from "vitest";
import type { Course } from "@/entities/course";
import { fetchUserCourses } from "@/entities/course/api/courseApi";

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "Error",
    json: () => Promise.resolve(body),
  });
}

describe("courseApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("fetchUserCourses", () => {
    const cap = {
      id: "cap-1",
      name: "TypeScript Fundamentals",
      description: "Learn TypeScript",
      code: "TS-101",
      level: "L2",
      priority: "Core",
      step: 1,
      totalLevels: 3,
      currentLevel: 0,
      status: "not_started",
      progress: 0,
    };

    it("maps capability to course shape", async () => {
      mockFetch(200, { success: true, capabilities: [cap] });
      const courses: Course[] = await fetchUserCourses("token");
      expect(courses).toHaveLength(1);
      expect(courses[0]).toMatchObject({
        id: "cap-1",
        capabilityId: "cap-1",
        capabilityCode: "TS-101",
        title: "TypeScript Fundamentals",
        description: "Learn TypeScript",
        priority: "Core",
        totalLevels: 3,
        currentLevel: 0,
        status: "not_started",
      });
    });

    it("falls back to generated code when capability code missing", async () => {
      mockFetch(200, {
        success: true,
        capabilities: [
          {
            id: "cap-2",
            name: "Test",
            description: "",
            totalLevels: 0,
            currentLevel: 0,
            status: "not_started",
            progress: 0,
          },
        ],
      });
      const courses = await fetchUserCourses("token");
      const course = courses[0]!;
      expect(course.capabilityCode).toMatch(/^CAP-/);
      expect(course.priority).toBe("");
    });

    it("returns empty array when no capabilities", async () => {
      mockFetch(200, { success: true, capabilities: [] });
      const courses = await fetchUserCourses("token");
      expect(courses).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      mockFetch(401, { success: false, error: { message: "Unauthorized" } });
      await expect(fetchUserCourses("bad-token")).rejects.toThrow("Unauthorized");
    });

    it("throws on failed success flag", async () => {
      mockFetch(200, { success: false });
      await expect(fetchUserCourses("token")).rejects.toThrow(
        "Invalid response format from server",
      );
    });
  });
});
