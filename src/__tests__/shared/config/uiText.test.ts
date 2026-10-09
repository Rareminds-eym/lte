import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENT_IMAGES,
  CAPABILITY_LEVEL_DESCRIPTIONS,
  SEARCH_QUERY_MAX_LENGTH,
  UI_TEXT,
} from "@/shared/config";
import { SearchQuerySchema } from "@/shared/schemas";

describe("uiText", () => {
  it("formats accessible labels without losing user-provided names", () => {
    expect(UI_TEXT.accountMenu("Alex")).toBe("Alex, account menu");
    expect(UI_TEXT.viewAchievement("First Project")).toBe("View First Project achievement");
    expect(UI_TEXT.capabilityComparison("Foundation", "Proficient")).toBe(
      "Current: Foundation · Target: Proficient",
    );
  });
  it("exposes public badge assets and the four capability level descriptions", () => {
    expect(
      Object.values(ACHIEVEMENT_IMAGES).every((path) => path.startsWith("/assets/images/")),
    ).toBe(true);
    expect(CAPABILITY_LEVEL_DESCRIPTIONS).toHaveLength(4);
  });
  it("validates and trims search input at its boundary", () => {
    expect(SearchQuerySchema.parse("  API design  ")).toBe("API design");
    expect(SearchQuerySchema.safeParse("a".repeat(SEARCH_QUERY_MAX_LENGTH + 1)).success).toBe(
      false,
    );
    expect(SearchQuerySchema.safeParse({ q: "API" }).success).toBe(false);
  });
});
