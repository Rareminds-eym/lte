import { describe, expect, it, vi } from "vitest";
import type { CatalogDependencies } from "../dependencies";
import { publishSnapshotTables } from "../ingestion/publish-snapshot-tables";
import { catalogFixture, id } from "./fixtures";

function table(rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0] ?? {});
  return { columns, rows: rows.map((row) => columns.map((column) => row[column])) };
}
describe("catalog table normalization and reference mapping", () => {
  it("checks ownership before writes and stops after ownership is lost during a write", async () => {
    const tables = {
      levels: table([
        { id, level_code: "CAP_L1", capability_id: id, level_id: id, title: "Changed" },
      ]),
      modules: table([{ id, level_id: id, title: "Must not change" }]),
    };
    const denied = catalogFixture();
    const deny = vi.fn(async () => {
      throw new Error("Lost owner");
    });
    await expect(
      publishSnapshotTables(tables, denied as unknown as CatalogDependencies["db"], deny),
    ).rejects.toThrow("Lost owner");
    expect(denied.calls.filter((call) => call.operation === "upsert")).toHaveLength(0);
    const db = catalogFixture();
    let owns = true;
    db.beforeExecute = async (query) => {
      if (query.operation === "upsert") owns = false;
    };
    const assertOwned = async () => {
      if (!owns) throw new Error("Lost owner");
    };
    await expect(
      publishSnapshotTables(tables, db as unknown as CatalogDependencies["db"], assertOwned),
    ).rejects.toThrow("Lost owner");
    expect(db.tables.levels[0].title).toBe("Changed");
    expect(db.tables.modules[0].title).toBe("Module");
  });
  it("preserves existing identities and resolves a complete uploaded course graph", async () => {
    const db = catalogFixture();
    db.tables.skills = [{ id: "33333333-3333-4333-8333-333333333333", code: "SKILL" }];
    const tables = {
      roles: table([{ id: "role", role_name: "Engineer" }]),
      capabilities: table([{ id: "cap", code: "CAP" }]),
      level_scale: table([{ id: "scale", level_no: 1, level_code: "L1" }]),
      skills: table([{ id: "skill", skill_code: "SKILL", tags: "one | two" }]),
      levels: table([
        {
          id: "level",
          level_code: "CAP_L1",
          capability_id: "CAP",
          level_id: "L1",
          title: "Updated",
          total_xp: "",
          duration_minutes: "invalid",
          observable_behavior: '["Observe","Report"]',
          example_outputs: { title: "Output" },
          created_at: null,
          updated_at: "",
        },
      ]),
      modules: table([
        {
          id: "module",
          level_id: "level",
          module_no: "0",
          pressure_points: ["Time"],
          user_confusion: "",
          prerequisites: "Basics | Safety",
          what_youll_learn: null,
          learning_content: '{"context":"example"}',
          knowledge: "",
          support: null,
          tools: "not json",
        },
      ]),
      modules_content: table([{ id: "stage", module_id: "module", stage_order: null }]),
      e_content: table([
        {
          id: "content",
          modules_content_id: "stage",
          duration_seconds: null,
          xp_reward: "2",
          sort_order: "",
          file_size_bytes: "",
        },
      ]),
      module_artifacts: table([
        { id: "artifact", modules_content_id: "stage", total_score: 10, passing_score: "" },
      ]),
      artifact_questions: table([
        {
          id: "question",
          artifact_id: "artifact",
          question_order: null,
          instructions: { required: "evidence" },
          allowed_file_types: '["pdf","xlsx"]',
          max_file_size_mb: "",
        },
      ]),
      artifact_templates: table([
        {
          id: "template",
          artifact_id: "artifact",
          question_id: "question",
          file_url: "/api/admin/lte/assets?key=resources/file.pdf",
        },
      ]),
      level_skills: table([
        {
          id: "level-skill",
          level_id: "level",
          skill_id: "SKILL",
          weightage: 2,
          metadata: { old: true },
          is_active: true,
        },
      ]),
    };
    const result = await publishSnapshotTables(tables, db as unknown as CatalogDependencies["db"]);
    expect(result.skipped).toBe(3);
    expect(result.inserted).toBe(9);
    expect(db.tables.levels[0]).toMatchObject({
      id,
      title: "Updated",
      capability_id: id,
      level_id: id,
      total_xp: 0,
      duration_minutes: 0,
      observable_behavior: ["Observe", "Report"],
      example_outputs: { title: "Output" },
      status: "published",
    });
    expect(db.tables.skills[0].tags).toEqual(["one", "two"]);
    expect(db.tables.modules[1].level_id).toBe(id);
    expect(db.tables.modules[1].prerequisites).toEqual(["Basics", "Safety"]);
    expect(db.tables.modules[1].learning_content).toEqual({ context: "example" });
    expect(db.tables.artifact_questions[1].allowed_file_types).toEqual(["pdf", "xlsx"]);
    expect(db.tables.level_skills[0].skill_id).toBe("33333333-3333-4333-8333-333333333333");
    expect(db.tables.level_skills[0].weightage).toBeUndefined();
    expect(
      db.calls
        .filter((call) => call.operation === "upsert")
        .every((call) => !["roles", "capabilities", "level_scale"].includes(call.table)),
    ).toBe(true);
  });
  it.each([
    "capabilities",
    "level_scale",
    "skills",
    "levels",
  ])("reports an unavailable %s reference read before publishing", async (name) => {
    const db = catalogFixture();
    db.failures.set(`${name}:read`, "Unavailable");
    await expect(
      publishSnapshotTables({}, db as unknown as CatalogDependencies["db"]),
    ).rejects.toThrow("Unavailable");
    expect(db.calls.filter((call) => call.operation === "upsert")).toHaveLength(0);
  });
  it("rejects unknown foreign keys and reports writes that fail", async () => {
    const db = catalogFixture();
    await expect(
      publishSnapshotTables(
        { levels: table([{ id: "new", capability_id: "UNKNOWN", level_code: "NEW_L1" }]) },
        db as unknown as CatalogDependencies["db"],
      ),
    ).rejects.toThrow("Cannot resolve");
    db.failures.set("modules:upsert", "Write failed");
    await expect(
      publishSnapshotTables(
        { modules: table([{ id: "module", level_id: "CAP_L1" }]) },
        db as unknown as CatalogDependencies["db"],
      ),
    ).rejects.toThrow("Write failed");
  });
  it.each([
    null,
    [],
    ["pdf", ""],
    "pdf | docx",
    "[invalid",
  ])("normalizes allowed file types %j using the workbook contract", async (allowed_file_types) => {
    const db = catalogFixture();
    await publishSnapshotTables(
      { artifact_questions: table([{ id: "new-question", allowed_file_types }]) },
      db as unknown as CatalogDependencies["db"],
    );
    const value = db.tables.artifact_questions[1].allowed_file_types;
    if (
      allowed_file_types === null ||
      (Array.isArray(allowed_file_types) && !allowed_file_types.length)
    )
      expect(value).toBeUndefined();
    else expect(value).toBeInstanceOf(Array);
  });
});
