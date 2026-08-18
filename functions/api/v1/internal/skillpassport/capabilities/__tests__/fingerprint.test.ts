import { describe, expect, it } from "vitest";
import { computeFingerprint } from "../sync/fingerprint";
import type { CapabilityWithModules } from "../types";

const base: CapabilityWithModules = {
  id: "cap-1",
  code: "BCP-CAP-CM-002",
  name: "Support exchange member",
  description: "Evidence handoffs",
  status: "in_progress",
  currentLevel: 1,
  totalLevels: 5,
  durationHours: 35,
  progress: 40,
  totalModules: 35,
  completedModules: 7,
  roleName: "Securities Operations Associate",
  levels: [
    {
      id: "lvl-1",
      code: "L1",
      title: "Intro",
      status: "completed",
      completionPercentage: 100,
      totalModules: 7,
      completedModules: 7,
    },
    {
      id: "lvl-2",
      code: "L2",
      title: "Advanced",
      status: "in_progress",
      completionPercentage: 0,
      totalModules: 7,
      completedModules: 0,
      modules: [
        {
          id: "mod-1",
          title: "Intro to Evidence",
          status: "completed",
          completionPercentage: 100,
        },
      ],
    },
  ],
};

describe("computeFingerprint", () => {
  it("is deterministic and a SHA-256 hex digest", async () => {
    expect(await computeFingerprint(base)).toBe(await computeFingerprint(base));
    expect(await computeFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when overall progress changes", async () => {
    const changed = { ...base, completedModules: 8 };
    expect(await computeFingerprint(changed)).not.toBe(await computeFingerprint(base));
  });

  it("changes when a level's progress changes", async () => {
    const changed = {
      ...base,
      levels: (base.levels ?? []).map((l, i) =>
        i === 1 ? { ...l, completionPercentage: 50, completedModules: 3 } : l,
      ),
    };
    expect(await computeFingerprint(changed)).not.toBe(await computeFingerprint(base));
  });

  it("changes when a module's title or completion changes", async () => {
    const renamedModule = {
      ...base,
      levels: (base.levels ?? []).map((l) =>
        l.modules
          ? {
              ...l,
              modules: l.modules.map((mod, i) => (i === 0 ? { ...mod, title: "Renamed" } : mod)),
            }
          : l,
      ),
    };
    const progressedModule = {
      ...base,
      levels: (base.levels ?? []).map((l) =>
        l.modules
          ? {
              ...l,
              modules: l.modules.map((mod, i) =>
                i === 0 ? { ...mod, status: "in_progress", completionPercentage: 40 } : mod,
              ),
            }
          : l,
      ),
    };
    expect(await computeFingerprint(renamedModule)).not.toBe(await computeFingerprint(base));
    expect(await computeFingerprint(progressedModule)).not.toBe(await computeFingerprint(base));
  });

  it("changes when xp, target level or priority change", async () => {
    expect(await computeFingerprint({ ...base, xp: 5000 })).not.toBe(
      await computeFingerprint(base),
    );
    expect(await computeFingerprint({ ...base, level: "L5" })).not.toBe(
      await computeFingerprint(base),
    );
    expect(await computeFingerprint({ ...base, priority: "Core" })).not.toBe(
      await computeFingerprint(base),
    );
  });

  it("changes when durationHours changes (it is part of the sync payload)", async () => {
    expect(await computeFingerprint({ ...base, durationHours: 40 })).not.toBe(
      await computeFingerprint(base),
    );
  });

  it("ignores module ids (non-content identifiers)", async () => {
    const diffModuleId = {
      ...base,
      levels: (base.levels ?? []).map((l) =>
        l.modules
          ? {
              ...l,
              modules: l.modules.map((mod, i) =>
                i === 0 ? { ...mod, id: "other-module-id" } : mod,
              ),
            }
          : l,
      ),
    };
    expect(await computeFingerprint(diffModuleId)).toBe(await computeFingerprint(base));
  });

  it("changes when name, description or role changes", async () => {
    expect(await computeFingerprint({ ...base, name: "Renamed" })).not.toBe(
      await computeFingerprint(base),
    );
    expect(await computeFingerprint({ ...base, description: "Changed" })).not.toBe(
      await computeFingerprint(base),
    );
    expect(await computeFingerprint({ ...base, roleName: "Other Role" })).not.toBe(
      await computeFingerprint(base),
    );
  });

  it("ignores non-content identifiers (capability id, level id)", async () => {
    const diffCapId = { ...base, id: "other-capability-id" };
    const diffLevelId = {
      ...base,
      levels: (base.levels ?? []).map((l, i) => (i === 0 ? { ...l, id: "other-level-id" } : l)),
    };
    expect(await computeFingerprint(diffCapId)).toBe(await computeFingerprint(base));
    expect(await computeFingerprint(diffLevelId)).toBe(await computeFingerprint(base));
  });
});
