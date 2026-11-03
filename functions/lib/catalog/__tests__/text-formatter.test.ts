import { describe, expect, it } from "vitest";
import { formatText } from "../ingestion/text-formatter";

describe("formatText()", () => {
  it("returns clean string when passed normal string", () => {
    expect(formatText("Build operational capability")).toBe("Build operational capability");
  });

  it("filters out [object Object] strings", () => {
    expect(formatText("[object Object]")).toBe("");
    expect(formatText("  [object Object]  ", "Fallback")).toBe("Fallback");
  });

  it("formats object with title and description", () => {
    expect(
      formatText({ title: "Project Progress", description: "Validate routine evidence" }),
    ).toBe("Project Progress: Validate routine evidence");
  });

  it("avoids duplicating title if description starts with title", () => {
    expect(
      formatText({ title: "Project Progress", description: "Project Progress: Validate evidence" }),
    ).toBe("Project Progress: Validate evidence");
  });

  it("formats object with description only", () => {
    expect(formatText({ description: "Validate routine evidence" })).toBe(
      "Validate routine evidence",
    );
  });

  it("formats object with title only", () => {
    expect(formatText({ title: "Project Progress" })).toBe("Project Progress");
  });

  it("parses JSON strings representing objects", () => {
    const jsonStr = JSON.stringify({ title: "JSON Title", description: "JSON Description" });
    expect(formatText(jsonStr)).toBe("JSON Title: JSON Description");
  });

  it("handles nested problem_statement objects", () => {
    expect(formatText({ problem_statement: { description: "Nested desc" } })).toBe("Nested desc");
  });

  it("formats arrays of values", () => {
    expect(formatText(["First item", { description: "Second item" }])).toBe(
      "First item, Second item",
    );
  });

  it("returns fallback for null, undefined, or empty values", () => {
    expect(formatText(null, "Default")).toBe("Default");
    expect(formatText(undefined, "Default")).toBe("Default");
    expect(formatText("", "Default")).toBe("Default");
  });
});
