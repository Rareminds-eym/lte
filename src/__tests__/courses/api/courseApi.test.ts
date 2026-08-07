import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/entities/course";
import { fetchCapabilityLevels, fetchUserCourses } from "@/entities/course/api/courseApi";
import { registerTokenGetter } from "@/shared/api";

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: "Error",
    json: () => Promise.resolve(body),
  });
}

describe("courseApi", () => {
  beforeEach(() => {
    registerTokenGetter(() => "token");
  });

  afterEach(() => {
    registerTokenGetter(() => null);
    vi.restoreAllMocks();
  });

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
      durationHours: 35,
    };

    it("maps capability to course shape", async () => {
      mockFetch(200, { success: true, capabilities: [cap] });
      const courses: Course[] = await fetchUserCourses();
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
        durationHours: 35,
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
      const courses = await fetchUserCourses();
      const course = courses[0];
      if (!course) {
        throw new Error("Expected one mapped course");
      }
      expect(course.capabilityCode).toMatch(/^CAP-/);
      expect(course.priority).toBe("");
    });

    it("returns empty array when no capabilities", async () => {
      mockFetch(200, { success: true, capabilities: [] });
      const courses = await fetchUserCourses();
      expect(courses).toEqual([]);
    });

    it("throws on non-ok response", async () => {
      mockFetch(401, { success: false, error: { message: "Unauthorized" } });
      await expect(fetchUserCourses()).rejects.toThrow("Unauthorized");
    });

    it("throws on failed success flag", async () => {
      mockFetch(200, { success: false });
      await expect(fetchUserCourses()).rejects.toThrow("Invalid response format from server");
    });
  });

  describe("fetchCapabilityLevels", () => {
    const rawLevel = {
      id: "lvl-1",
      levelNumber: null,
      code: null,
      title: null,
      description: ["Step 1", "Step 2"],
      deliverables: null,
      durationMinutes: null,
      difficulty: null,
      status: null,
    };

    it("fetches and parses capability levels correctly with transformations", async () => {
      mockFetch(200, {
        success: true,
        capability: { id: "cap-1", code: "TS-101", name: "TS" },
        levels: [rawLevel],
      });

      const levels = await fetchCapabilityLevels("TS-101");
      expect(levels).toHaveLength(1);
      expect(levels[0]).toEqual({
        id: "lvl-1",
        levelNumber: 1,
        code: "",
        title: "",
        description: "Step 1 Step 2",
        deliverables: [],
        durationMinutes: 0,
        difficulty: "intermediate",
        status: "published",
      });
    });

    it("throws ApiError on failed parse format", async () => {
      mockFetch(200, {
        success: false,
      });

      await expect(fetchCapabilityLevels("TS-101")).rejects.toThrow(
        "Invalid response format from server",
      );
    });
  });
});
