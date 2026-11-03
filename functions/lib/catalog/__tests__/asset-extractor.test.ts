import { describe, expect, it } from "vitest";
import { ASSET_EXTRACTION_CONFIG, extractAssets } from "../ingestion/asset-extractor";

describe("extractAssets", () => {
  it("exports an explicit table/column configuration", () => {
    expect(ASSET_EXTRACTION_CONFIG["e_content"]).toContain("learning_content.context_link");
  });

  it("extracts configured URLs and tracks exact row field paths", () => {
    const assets = extractAssets({
      tables: {
        module_artifacts: {
          columns: ["id", "template_url"],
          rows: [["1", "https://drive.google.com/file/d/template-id/view?usp=sharing"]],
        },
      },
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]!).toMatchObject({
      originalUrl: "https://drive.google.com/file/d/template-id/view?usp=sharing",
      tableName: "module_artifacts",
      rowIndex: 0,
      fieldPath: "tables.module_artifacts.rows.0.template_url",
    });
  });

  it("supports configured nested JSON paths", () => {
    const assets = extractAssets({
      tables: {
        e_content: {
          columns: ["learning_content"],
          rows: [[{ context_link: "https://docs.google.com/presentation/d/deck-id/edit" }]],
        },
      },
    });

    expect(assets[0]!.fieldPath).toBe("tables.e_content.rows.0.learning_content.context_link");
  });
  it("rejects multiple URLs or URL arrays in a scalar field before replacement", () => {
    for (const value of [
      "https://drive.google.com/file/d/a/view | https://drive.google.com/file/d/b/view",
      ["https://drive.google.com/file/d/a/view"],
    ]) {
      expect(() =>
        extractAssets({ tables: { e_content: { columns: ["url"], rows: [[value]] } } }),
      ).toThrow("one URL per row");
    }
  });

  it("deduplicates URLs while preserving every occurrence", () => {
    const assets = extractAssets({
      tables: {
        artifact_questions: {
          columns: ["reference_url", "solution_url"],
          rows: [
            [
              "https://drive.google.com/file/d/shared-id/view",
              "https://drive.google.com/file/d/shared-id/view",
            ],
            ["https://drive.google.com/file/d/shared-id/view", null],
          ],
        },
      },
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]!.occurrences).toHaveLength(3);
  });

  it("ignores URLs in unconfigured columns and tables", () => {
    expect(
      extractAssets({
        tables: { random_table: { columns: ["url"], rows: [["https://example.com/secret"]] } },
      }),
    ).toEqual([]);
  });

  it("extracts artifact template file URLs but leaves non-Google external links alone", () => {
    const assets = extractAssets({
      tables: {
        artifact_templates: {
          columns: ["file_url"],
          rows: [
            ["https://docs.google.com/spreadsheets/d/sheet-id/edit"],
            ["https://example.com/external-reference.html"],
          ],
        },
      },
    });

    expect(assets.map((asset) => asset.originalUrl)).toEqual([
      "https://docs.google.com/spreadsheets/d/sheet-id/edit",
    ]);
    expect(assets[0]!.fieldPath).toBe("tables.artifact_templates.rows.0.file_url");
  });
});
