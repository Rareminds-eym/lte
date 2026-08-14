import { getLevelWithModules, getModuleDetails } from "@functions/api/v1/courses/queries";
import {
  CapabilityLevelParamsSchema,
  LevelIdParamsSchema,
  LevelModuleParamsSchema,
} from "@functions/api/v1/courses/schemas";
import { describe, expect, it, vi } from "vitest";
import { err, levelChains, makeGateway, moduleDetailsChains, ok } from "./helpers";

const levelId = "0a010796-10c0-5287-b89a-6ab56bd71399";

describe("Level Content API Schemas & Queries", () => {
  describe("Zod Param Validation Schemas", () => {
    it("validates valid level id params", () => {
      const res = LevelIdParamsSchema.safeParse({ levelId });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.levelId).toBe(levelId);
      }
    });

    it("rejects empty level id params", () => {
      const res = LevelIdParamsSchema.safeParse({ levelId: "" });
      expect(res.success).toBe(false);
    });

    it("validates capabilityCode and levelId params", () => {
      const res = CapabilityLevelParamsSchema.safeParse({
        capabilityCode: "backend-engineering",
        levelId,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.levelId).toBe(levelId);
        expect(res.data.capabilityCode).toBe("backend-engineering");
      }
    });

    it("validates valid level and module params", () => {
      const res = LevelModuleParamsSchema.safeParse({
        levelId,
        moduleNo: "0",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.levelId).toBe(levelId);
        expect(res.data.moduleNo).toBe("0");
      }
    });

    it("rejects non-integer module numbers", () => {
      const res = LevelModuleParamsSchema.safeParse({
        levelId,
        moduleNo: "abc",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("getLevelWithModules query logic", () => {
    it("returns formatted level details and module summaries", async () => {
      const levelData = {
        id: levelId,
        level_code: "crs-sys-fail-inv",
        title: "System Failure Investigation",
        description: "Investigate latency spikes",
        problem_statement: {
          title: "System Failure Investigation",
          description: "A production incident needs evidence-led investigation.",
        },
        observable_behavior: "Identifies root cause",
        example_outputs: "RCA document",
        duration_minutes: 270,
        difficulty_level: "intermediate",
        status: "published",
        version_no: 1,
        capability_id: "cap-1",
      };

      const modulesData = [
        {
          id: "mod-0",
          module_no: 0,
          title: "System Failure Investigation",
          description: "Incident Kickoff",
          is_published: true,
          is_active: true,
          module_problem_statement: null,
          pressure_points: null,
          user_confusion: null,
          industry_challenge: null,
          prerequisites: null,
          what_youll_learn: null,
          when_to_apply: null,
        },
        {
          id: "mod-1",
          module_no: 1,
          title: "Structured Logging",
          description: "JSON logs",
          is_published: true,
          is_active: true,
          module_problem_statement: null,
          pressure_points: null,
          user_confusion: null,
          industry_challenge: null,
          prerequisites: null,
          what_youll_learn: null,
          when_to_apply: null,
        },
      ];

      const chains = levelChains({
        level: levelData,
        capabilities: ok({ code: "TEST", name: "Test" }),
        modules: ok(modulesData),
        modulesContent: ok([]),
        artifacts: ok([]),
      });
      const gateway = makeGateway(chains);

      const result = await getLevelWithModules(gateway, levelId);

      expect(result).not.toBeNull();
      expect(chains.modules?.eq).toHaveBeenCalledWith("level_id", levelId);
      expect(result?.levelCode).toBe("crs-sys-fail-inv");
      expect(result?.title).toBe("System Failure Investigation");
      expect(result?.levelProblemStatement.description).toBe(
        "A production incident needs evidence-led investigation.",
      );
      expect(result?.modules.length).toBe(2);
      expect(result?.modules[0]?.moduleNo).toBe(0);
      expect(result?.modules[1]?.moduleNo).toBe(1);
    });

    it("returns null when level is not found (PGRST116)", async () => {
      const gateway = makeGateway(levelChains({ levelResult: { data: null, error: null } }));

      const result = await getLevelWithModules(gateway, "00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });

    it("throws error for unanticipated DB failures", async () => {
      const gateway = makeGateway(
        levelChains({ levelResult: err("Database connection failed", "PGRST500") }),
      );

      await expect(
        getLevelWithModules(gateway, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("getModuleDetails query logic", () => {
    it("returns complete module details with 6E stages and items", async () => {
      const mockLevelSingle = vi.fn().mockResolvedValue({
        data: {
          id: levelId,
          level_code: "crs-sys-fail-inv",
          title: "System Failure Investigation",
        },
        error: null,
      });

      const mockModuleSingle = vi.fn().mockResolvedValue({
        data: {
          id: "mod-0",
          level_id: levelId,
          module_no: 0,
          title: "System Failure Investigation",
          description: "Incident Kickoff",
          support: { estimatedMinutes: 30 },
          knowledge: {},
          tools: {},
          learning_content: {},
        },
        error: null,
      });
      const modulesContentData = [
        {
          id: "mc-engage",
          stage_name: "engage",
          stage_order: 1,
          stage_description: "Understand the incident context before taking action.",
          is_active: true,
          e_content: [
            {
              id: "item-1",
              content_type: "video",
              title: "Incident Kickoff: API Latency Spike",
              description: "Alert walkthrough",
              url: "https://example.com/video.mp4",
              sort_order: 1,
              duration_seconds: 540,
              xp_reward: 50,
              mime_type: "video/mp4",
              file_size_bytes: 1024000,
              status: "published",
            },
            {
              id: "item-2",
              content_type: "pdf",
              title: "Failure Investigation Workbook",
              description: "Workbook",
              url: "https://example.com/doc.pdf",
              sort_order: 2,
              duration_seconds: 300,
              xp_reward: 25,
              mime_type: "application/pdf",
              file_size_bytes: 512000,
              status: "published",
            },
          ],
          module_artifacts: [],
        },
      ];

      const gateway = makeGateway(
        moduleDetailsChains({
          levelResult: await mockLevelSingle(),
          moduleResult: await mockModuleSingle(),
          modulesContent: ok(modulesContentData),
        }),
      );

      const result = await getModuleDetails(gateway, levelId, 0);

      expect(result).not.toBeNull();
      expect(result?.moduleNo).toBe(0);
      expect(result?.levelCode).toBe("crs-sys-fail-inv");
      expect(result?.stages.length).toBe(6); // All 6E stages ensured

      const engageStage = result?.stages.find((s) => s.stageName === "engage");
      expect(engageStage).toBeDefined();
      expect(engageStage?.stageDescription).toBe(
        "Understand the incident context before taking action.",
      );
      expect(engageStage?.items.length).toBe(2);
      expect(engageStage?.items[0]?.contentType).toBe("video");
      expect(engageStage?.items[1]?.contentType).toBe("pdf");
    });

    it("returns null when level or module does not exist", async () => {
      const gateway = makeGateway(
        moduleDetailsChains({ levelResult: { data: null, error: null } }),
      );

      const result = await getModuleDetails(gateway, "00000000-0000-0000-0000-000000000000", 99);
      expect(result).toBeNull();
    });
  });
});
