/**
 * Gold-standard regression suite (Phase 3): pins end-to-end evaluation
 * behaviour (input → canned model response → validated output) so prompt,
 * template or validation changes cannot silently shift outcomes. Any change
 * to the evaluation pipeline must update these fixtures deliberately.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateArtifactSubmission } from "../../artifact-evaluator";
import { goldStandardFixtures } from "./gold-standard";

const { callOpenRouterAI } = vi.hoisted(() => ({ callOpenRouterAI: vi.fn() }));

vi.mock("@functions/lib/ai-engine/openrouter", () => ({
  callOpenRouterAI,
  DEFAULT_OPENROUTER_MODEL: "google/gemini-2.5-flash",
  OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
  DEFAULT_OPENROUTER_SITE_NAME: "LTE",
  DEFAULT_OPENROUTER_SITE_URL: "https://lte.rareminds.in",
}));

describe("gold standard evaluation regression", () => {
  beforeEach(() => {
    callOpenRouterAI.mockReset();
  });

  for (const fixture of goldStandardFixtures) {
    it(fixture.name, async () => {
      vi.mocked(callOpenRouterAI).mockResolvedValue(fixture.modelRawResponse);

      const evaluated = await evaluateArtifactSubmission(
        { OPENROUTER_API_KEY: "test-key" } as never,
        fixture.input,
      );

      expect(evaluated.decision).toBe(fixture.expected.decision);
      expect(evaluated.overallScore).toBe(fixture.expected.overallScore);
      expect(evaluated.confidence).toBe(fixture.expected.confidence);
      expect(evaluated.provider).toBe("openrouter");
      expect(
        evaluated.rubricRows.every((row) => row.evidenceValid === fixture.expected.evidenceValid),
      ).toBe(true);
    });
  }
});
