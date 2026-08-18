import { describe, expect, it } from "vitest";
import type { SkillWithContext } from "../queries/get-skills";
import { mapSkillsToSyncPayload } from "../sync/payload";

const skill = (overrides: Partial<SkillWithContext> = {}): SkillWithContext => ({
  id: "skill-1",
  code: "SK-001",
  name: "Classify Work Objects",
  description: "Classify GenAI workflow objects",
  tags: ["classify", "genai"],
  levelId: "lvl-1",
  levelCode: "CAP-L1",
  levelTitle: "Foundation",
  capabilityId: "cap-1",
  capabilityCode: "CAP",
  capabilityName: "Capability One",
  levelStatus: "completed",
  completedAt: "2026-08-13T05:11:42Z",
  ...overrides,
});

const mapOne = async (source: SkillWithContext): Promise<import("../types").SyncSkill> => {
  const [mapped] = await mapSkillsToSyncPayload([source]);
  if (!mapped) throw new Error("expected at least one mapped skill");
  return mapped;
};

describe("mapSkillsToSyncPayload", () => {
  it("maps every field onto the flat SyncSkill shape", async () => {
    const mapped = await mapOne(skill());
    expect(mapped).toMatchObject({
      id: "skill-1",
      code: "SK-001",
      name: "Classify Work Objects",
      description: "Classify GenAI workflow objects",
      tags: ["classify", "genai"],
      levelId: "lvl-1",
      levelCode: "CAP-L1",
      levelTitle: "Foundation",
      capabilityId: "cap-1",
      capabilityCode: "CAP",
      capabilityName: "Capability One",
      levelStatus: "completed",
      completedAt: "2026-08-13T05:11:42Z",
    });
    expect(mapped.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("has NO resumeUrl field (skills have no continue-learning deep-link)", async () => {
    const mapped = await mapOne(skill());
    expect(mapped).not.toHaveProperty("resumeUrl");
  });

  it("returns an empty array for an empty input", async () => {
    expect(await mapSkillsToSyncPayload([])).toEqual([]);
  });

  it("produces a fingerprint that is deterministic and content-sensitive", async () => {
    const [a, b, renamed] = await mapSkillsToSyncPayload([
      skill(),
      skill(),
      skill({ name: "Renamed Skill" }),
    ]);
    expect(a?.fingerprint).toBe(b?.fingerprint);
    expect(renamed?.fingerprint).not.toBe(a?.fingerprint);
  });

  it("does not let a differing skill id change the fingerprint (identifier excluded)", async () => {
    const [a, b] = await mapSkillsToSyncPayload([skill(), skill({ id: "other-id" })]);
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it("leaves optional fields undefined when absent on the source", async () => {
    const mapped = await mapOne(
      skill({ code: undefined, description: undefined, tags: undefined }),
    );
    expect(mapped.code).toBeUndefined();
    expect(mapped.description).toBeUndefined();
    expect(mapped.tags).toBeUndefined();
  });
});
