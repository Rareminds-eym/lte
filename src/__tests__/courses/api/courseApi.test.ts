import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/entities/course";
import { fetchUserCourses } from "@/entities/course/api/courseApi";
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
      expect(courses[0]?.capabilityCode).toBe("CAP-1");
    });

    it("throws on non-ok status with backend error message", async () => {
      mockFetch(400, { error: { message: "Invalid request" } });
      await expect(fetchUserCourses()).rejects.toThrow("Invalid request");
    });

    it("throws fallback error message when JSON body parse fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Parse fail")),
      });
      await expect(fetchUserCourses()).rejects.toThrow("Request failed with status 500");
    });

    it("throws error when ok response but JSON invalid format", async () => {
      mockFetch(200, { success: false }); // schema safeParse fails
      await expect(fetchUserCourses()).rejects.toThrow("Invalid response format from server");
    });
  });
});
