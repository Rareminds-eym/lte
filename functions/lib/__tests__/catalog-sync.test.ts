import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncManagedCatalog } from "../catalog-sync";
import type { QueryGateway } from "../query-gateway";
import { callSkill } from "../skill-gateway";
import type { LteEnv } from "../types";

vi.mock("../skill-gateway", () => ({ callSkill: vi.fn() }));
const roleId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const env = {} as LteEnv;
const names = [
  "roles",
  "capabilities",
  "level_scale",
  "role_capability_sequence",
  "skills",
  "levels",
  "level_skills",
  "modules",
  "modules_content",
  "e_content",
  "module_artifacts",
  "artifact_questions",
  "artifact_templates",
];
const snapshot = () => ({
  version: 1,
  tables: Object.fromEntries(names.map((name) => [name, name === "roles" ? [{ id: roleId }] : []])),
});
beforeEach(() => vi.resetAllMocks());
describe("missing catalogue recovery via SkillPassport", () => {
  it("does not fetch or import catalogue already present locally", async () => {
    const rpc = vi.fn().mockResolvedValue([]);
    await syncManagedCatalog({ rpc } as unknown as QueryGateway, env, [roleId], userId);
    expect(callSkill).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("fetches only missing roles through the authenticated SkillPassport gateway", async () => {
    const rpc = vi.fn().mockResolvedValueOnce([roleId]).mockResolvedValueOnce(null);
    vi.mocked(callSkill).mockResolvedValue(snapshot());
    await syncManagedCatalog({ rpc } as unknown as QueryGateway, env, [roleId], userId);
    expect(callSkill).toHaveBeenCalledWith(
      env,
      "catalogue:get",
      { userId, roleIds: [roleId] },
      userId,
    );
    expect(rpc).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: "import_managed_lte_catalog" }),
      { args: { p_tables: snapshot().tables } },
    );
  });
  it.each([
    "upstream",
    "missing-role",
    "missing-table",
    "extra-table",
  ])("never imports invalid data: %s", async (mode) => {
    const data = snapshot();
    if (mode === "missing-role") data.tables["roles"] = [];
    if (mode === "missing-table") delete data.tables["levels"];
    if (mode === "extra-table") data.tables["users"] = [];
    if (mode === "upstream") vi.mocked(callSkill).mockRejectedValue(new Error("Unavailable"));
    else vi.mocked(callSkill).mockResolvedValue(data);
    const rpc = vi.fn().mockResolvedValue([roleId]);
    await expect(
      syncManagedCatalog({ rpc } as unknown as QueryGateway, env, [roleId], userId),
    ).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
