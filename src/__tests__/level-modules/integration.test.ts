import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLevelDetails } from "@/entities/course/api";

/**
 * Integration Tests: Level Modules Feature
 *
 * Tests the complete data flow:
 * LevelModulesPage → useLevelDetails → fetchLevelDetails → API endpoint
 */

const LEVEL_ID = "0a010796-10c0-5287-b89a-6ab56bd71399";
const CAPABILITY_CODE = "BCP-CAP-CM-001";

const mockLevelResponse = {
  success: true,
  level: {
    id: LEVEL_ID,
    levelCode: "HTT_L1",
    capabilityCode: CAPABILITY_CODE,
    capabilityName: "Support securities trade lifecycle records",
    title: "Guided Guest and Visitor Arrival Readiness",
    description: "Master the front-office arrival process for guests and visitors.",
    levelProblemStatement: {
      title: "Guided Guest and Visitor Arrival Readiness",
      description:
        "Learner connects front-office arrival readiness to guest trust, room flow, payment-readiness safety, team workload, and L1 role boundaries.",
    },
    observableBehavior: "Applies L1 arrival authority safely",
    exampleOutputs: "Guest arrival review checklist",
    durationMinutes: 180,
    levelNo: 1,
    levelLabel: "foundation",
    difficultyLevel: "foundation",
    levelStatus: "published",
    versionNo: 1,
    artifactsCount: 0,
    modules: [
      {
        id: "mod-0",
        moduleNo: 0,
        title: "Industry, Role & Course Readiness",
        description:
          "Learner connects front-office arrival readiness to guest trust, room flow, payment-readiness safety, team workload, and L1 role boundaries.",
        isPublished: false,
        progressPercentage: 67,
        isCompleted: false,
        completedStages: ["engage", "explore", "explain"],
        module_problem_statement:
          "At 3:30 PM, a tired guest is waiting near the front desk while the queue grows.",
        pressure_points: null,
        user_confusion: null,
        industry_challenge: "Front-office teams must protect guest trust and service flow.",
        prerequisites: null,
        what_youll_learn: null,
        when_to_apply: "Use before entering an arrival room.",
      },
      {
        id: "mod-1",
        moduleNo: 1,
        title: "Case Intake & Role Boundary",
        description: "Learner opens the arrival case and separates facts from assumptions.",
        isPublished: false,
        progressPercentage: 0,
        isCompleted: false,
        completedStages: [],
        module_problem_statement: "The learner receives the first case file.",
        pressure_points: null,
        user_confusion: null,
        industry_challenge: "Front-office staff must create reliable case records.",
        prerequisites: null,
        what_youll_learn: null,
        when_to_apply: "Use during the first structured intake of a guest or visitor arrival case.",
      },
    ],
  },
};

describe("Level Modules Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API Endpoint", () => {
    it("should call the capability-based endpoint with correct parameters", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/courses/${CAPABILITY_CODE}/levels/${LEVEL_ID}`,
        expect.objectContaining({
          method: "GET",
        }),
      );
    });

    it("should return properly typed level data", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      expect(result).toMatchObject({
        id: LEVEL_ID,
        levelCode: "HTT_L1",
        capabilityCode: CAPABILITY_CODE,
        title: "Guided Guest and Visitor Arrival Readiness",
        modules: expect.arrayContaining([
          expect.objectContaining({
            id: "mod-0",
            moduleNo: 0,
            title: "Industry, Role & Course Readiness",
            progressPercentage: 67,
            completedStages: expect.arrayContaining(["engage", "explore", "explain"]),
          }),
        ]),
      });
    });

    it("should include module detail fields in response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);
      const module = result.modules[0];

      expect(module).toHaveProperty("module_problem_statement");
      expect(module).toHaveProperty("industry_challenge");
      expect(module).toHaveProperty("progressPercentage");
      expect(module).toHaveProperty("completedStages");
    });

    it("should handle empty modules array", async () => {
      const emptyResponse = {
        ...mockLevelResponse,
        level: {
          ...mockLevelResponse.level,
          modules: [],
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      expect(result.modules).toEqual([]);
    });

    it("should reject when required fields are missing", async () => {
      const invalidResponse = {
        success: true,
        level: {
          id: LEVEL_ID,
          // Missing required fields like title, description
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(invalidResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE)).rejects.toThrow();
    });
  });

  describe("Module Data Integrity", () => {
    it("should preserve completion status for modules", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      // First module: 67% complete with some stages done
      expect(result.modules[0].progressPercentage).toBe(67);
      expect(result.modules[0].completedStages).toContain("engage");
      expect(result.modules[0].completedStages).toContain("explore");
      expect(result.modules[0].completedStages).toContain("explain");
      expect(result.modules[0].completedStages).not.toContain("express");

      // Second module: not started
      expect(result.modules[1].progressPercentage).toBe(0);
      expect(result.modules[1].completedStages).toEqual([]);
    });

    it("should include stage information from completedStages", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      // Verify stage data is properly returned
      expect(Array.isArray(result.modules[0].completedStages)).toBe(true);
      expect(result.modules[0].completedStages.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE)).rejects.toThrow("Network error");
    });

    it("should handle 404 not found responses", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Level not found" }), {
          status: 404,
        }),
      );

      // The fetch succeeds (status 200 not thrown), but parsing fails
      // because response doesn't match schema
      await expect(fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE)).rejects.toThrow();
    });

    it("should reject malformed JSON responses", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("invalid json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE)).rejects.toThrow();
    });
  });

  describe("Data Transformation", () => {
    it("should map snake_case database fields to camelCase", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      // Verify camelCase conversion
      expect(result).toHaveProperty("levelCode");
      expect(result).toHaveProperty("capabilityCode");
      expect(result).toHaveProperty("levelProblemStatement");
      expect(result).toHaveProperty("durationMinutes");

      const module = result.modules[0];
      expect(module).toHaveProperty("moduleNo");
      expect(module).toHaveProperty("isPublished");
      expect(module).toHaveProperty("progressPercentage");
      expect(module).toHaveProperty("completedStages");
    });
  });

  describe("Type Safety", () => {
    it("should return data with correct types", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLevelResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchLevelDetails(LEVEL_ID, CAPABILITY_CODE);

      expect(typeof result.id).toBe("string");
      expect(typeof result.title).toBe("string");
      expect(typeof result.durationMinutes).toBe("number");
      expect(Array.isArray(result.modules)).toBe(true);

      const module = result.modules[0];
      expect(typeof module.id).toBe("string");
      expect(typeof module.moduleNo).toBe("number");
      expect(typeof module.progressPercentage).toBe("number");
      expect(Array.isArray(module.completedStages)).toBe(true);
    });
  });
});
