import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLevelDetails, fetchLevelModuleDetails } from "@/entities/course";

const levelId = "0a010796-10c0-5287-b89a-6ab56bd71399";

const levelPayload = {
  success: true,
  level: {
    id: "course-1",
    levelCode: "crs-sys-fail-inv",
    title: "System Failure Investigation",
    description: "Investigate production incidents.",
    levelProblemStatement: {
      title: "System Failure Investigation",
      description: "A production incident needs evidence-led investigation.",
    },
    observableBehavior: "Diagnoses failures.",
    exampleOutputs: "Incident review.",
    durationMinutes: 120,
    difficultyLevel: "intermediate",
    levelStatus: "published",
    versionNo: 1,
    modules: [
      {
        id: "module-1",
        moduleNo: 1,
        title: "Incident Signals",
        description: "Read logs and symptoms.",
        isPublished: true,
      },
    ],
  },
};

const modulePayload = {
  success: true,
  module: {
    id: "module-1",
    levelId: "course-1",
    levelCode: "crs-sys-fail-inv",
    levelTitle: "System Failure Investigation",
    moduleNo: 1,
    title: "Incident Signals",
    description: "Read logs and symptoms.",
    moduleProblemStatement: null,
    pressurePoints: ["Customer pressure"],
    userConfusion: ["May skip evidence"],
    industryChallenge: null,
    prerequisites: ["Basic debugging knowledge"],
    whatYoullLearn: ["How to isolate useful signals"],
    whenToApply: null,
    support: {},
    knowledge: {},
    tools: {},
    learningContent: {},
    stages: [
      {
        id: "stage-engage",
        stageName: "engage",
        stageOrder: 1,
        stageDescription: "Understand the incident context before taking action.",
        items: [],
        artifacts: [],
        isActive: true,
      },
    ],
  },
};

describe("level content client API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches level details through the dynamic course endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(levelPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchLevelDetails(levelId)).resolves.toEqual(levelPayload.level);
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/courses/${levelId}`, {
      credentials: "include",
      method: "GET",
    });
  });

  it("fetches module details through the dynamic module endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(modulePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchLevelModuleDetails(levelId, 1)).resolves.toEqual(modulePayload.module);
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/courses/${levelId}/modules/1`, {
      credentials: "include",
      method: "GET",
    });
  });

  it("rejects invalid API response shapes before rendering", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, level: { id: "course-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchLevelDetails(levelId)).rejects.toThrow();
  });
});
