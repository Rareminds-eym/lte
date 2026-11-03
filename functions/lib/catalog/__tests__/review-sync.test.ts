/* eslint-disable @typescript-eslint/no-explicit-any -- Persisted catalog fixture rows contain heterogeneous values. */
import { describe, expect, it } from "vitest";
import { syncCourseEditsToTables } from "../ingestion/review-sync";
import type { LTELevelCourse } from "../types";

function baseTables(): any {
  return {
    levels: {
      columns: ["id", "level_code", "title", "description", "problem_statement"],
      rows: [["lvl-1", "CAP_L1", "Old title", "Old desc", "Old problem"]],
    },
    modules: {
      columns: ["id", "level_id", "module_no", "title", "description", "module_problem_statement"],
      rows: [["mod-1", "lvl-1", 0, "Old mod", "Old ctx", "Old ps"]],
    },
    modules_content: {
      columns: [
        "id",
        "module_id",
        "stage_name",
        "stage_description",
        "module_context",
        "curriculum_reference",
      ],
      rows: [
        [
          "mc-engage",
          "mod-1",
          "Engage",
          "Old stage",
          "Old ctx",
          { prerequisites: ["a"], technical_concepts: ["t"] },
        ],
      ],
    },
    e_content: {
      columns: [
        "id",
        "modules_content_id",
        "content_type",
        "title",
        "description",
        "url",
        "xp_reward",
        "duration_seconds",
        "mime_type",
      ],
      rows: [
        [
          "ec-1",
          "mc-engage",
          "article",
          "Old asset",
          "Old asset desc",
          "https://old.test",
          50,
          300,
          "text/html",
        ],
      ],
    },
    module_artifacts: {
      columns: ["id", "modules_content_id", "artifact_type", "total_score", "passing_score"],
      rows: [["art-1", "mc-engage", "practice", 10, 6]],
    },
    artifact_questions: {
      columns: ["id", "artifact_id", "title", "description", "instructions"],
      rows: [["q-1", "art-1", "Old q", "Old qd", "required: x"]],
    },
    artifact_templates: {
      columns: ["id", "artifact_id", "file_name", "file_url"],
      rows: [["t-1", "art-1", "old.xlsx", "https://drive.google.com/old"]],
    },
  };
}

function editedCourse(): LTELevelCourse {
  return {
    levelCode: "CAP_L1",
    levelNo: 1,
    levelName: "Course",
    courseMetadata: {
      courseTitle: "New title",
      courseCode: "CAP_L1",
      domain: "General",
      capabilityCode: "CAP",
      capabilityLevel: "Level 1",
      instructorLead: "Lead",
      courseSummary: "New desc",
      problemStatement: "New problem",
      capstoneTitle: "",
    },
    modules: [
      {
        index: 0,
        title: "New mod",
        subtitle: "",
        completionPercentage: 0,
        status: "in_progress",
        contextDescription: "New ctx",
        moduleProblemStatement: "New ps",
        stages: [
          {
            id: "ec-1",
            stageIndex: 1,
            name: "Engage",
            label: "Engage",
            subtitle: "",
            description: "New stage desc",
            mediaType: "video",
            estimatedDuration: "5 mins",
            contentItemsCount: 1,
            xpReward: 80,
            prerequisites: ["p1", "p2"],
            technicalConcepts: ["t1"],
            engineeringContext: "New eng ctx",
            assets: [
              { id: "ec-1", title: "New asset", url: "https://new.test", contentType: "video/mp4" },
            ],
          } as any,
        ],
        artifactPractices: [
          {
            id: "art-1",
            moduleIndex: 0,
            practiceIndex: 1,
            title: "Practice",
            totalScore: 20,
            passingScore: 12,
            questions: [
              {
                id: "q-1",
                title: "New q",
                description: "New qd",
                instructions: { required_fields: "r", pass_criteria: "p", critical_fail: "c" },
              },
            ],
            templates: [
              { id: "t-1", fileName: "new.xlsx", fileUrl: "https://drive.google.com/new" },
            ],
          },
        ],
      } as any,
    ],
  };
}

describe("syncCourseEditsToTables", () => {
  it("pushes preview edits into snapshot tables so publish persists them", () => {
    const tables = baseTables();
    const result = syncCourseEditsToTables(tables as any, editedCourse());

    expect(result.applied).toBeGreaterThan(10);
    expect(tables.levels.rows[0][2]).toBe("New title");
    expect(tables.levels.rows[0][3]).toBe("New desc");
    expect(tables.levels.rows[0][4]).toBe("New problem");
    expect(tables.modules.rows[0][3]).toBe("New mod");
    expect(tables.modules.rows[0][4]).toBe("New ctx");
    expect(tables.modules.rows[0][5]).toBe("New ps");

    // Stage e-row
    expect(tables.e_content.rows[0][4]).toBe("New stage desc");
    expect(tables.e_content.rows[0][2]).toBe("video");
    expect(tables.e_content.rows[0][6]).toBe(80);
    expect(tables.e_content.rows[0][7]).toBe(300);

    // Curriculum merge preserves existing keys object
    const ref = tables.modules_content.rows[0][5] as Record<string, unknown>;
    expect(ref["prerequisites"]).toEqual(["p1", "p2"]);
    expect(ref["technical_concepts"]).toEqual(["t1"]);
    expect(tables.modules_content.rows[0][4]).toBe("New eng ctx");

    // Asset on same e-row
    expect(tables.e_content.rows[0][3]).toBe("New asset");
    expect(tables.e_content.rows[0][5]).toBe("https://new.test");
    expect(tables.e_content.rows[0][8]).toBe("video/mp4");

    // Artifact scores + question + template
    expect(tables.module_artifacts.rows[0][3]).toBe(20);
    expect(tables.module_artifacts.rows[0][4]).toBe(12);
    expect(tables.artifact_questions.rows[0][2]).toBe("New q");
    expect(tables.artifact_questions.rows[0][4]).toBe(
      "required: r | pass_criteria: p | critical_fail: c",
    );
    expect(tables.artifact_templates.rows[0][2]).toBe("new.xlsx");
    expect(tables.artifact_templates.rows[0][3]).toBe("https://drive.google.com/new");
  });

  it("warns instead of crashing on unknown rows", () => {
    const tables = baseTables();
    tables.levels.rows = [];
    const result = syncCourseEditsToTables(tables as any, editedCourse());
    expect(result.applied).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
