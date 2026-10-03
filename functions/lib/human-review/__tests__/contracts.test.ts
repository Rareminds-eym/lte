import { describe, expect, it } from "vitest";
import {
  completionHash,
  completionSchema,
  normalizeCompletion,
  REVIEW_CRITERIA,
} from "../contracts";

const command = () => ({
  expectedVersion: 2,
  decision: "pass" as const,
  criteria: REVIEW_CRITERIA.map(({ id }) => ({
    id,
    score: 2,
    evidence: "Observed in the submitted artifact",
  })),
  feedback: "Meets the required standard",
  actionItems: [],
  rationale: "Evidence verified",
  hasCriticalFailure: false,
});
describe("review completion boundary", () => {
  it("calculates the total from criterion scores, rejecting injected totals", () => {
    expect(normalizeCompletion(completionSchema.parse(command())).score).toBe(67);
    expect(completionSchema.safeParse({ ...command(), score: 100 }).success).toBe(false);
  });
  it("rejects duplicate criteria, unknown criteria, missing evidence and critical-failure passes", () => {
    const duplicate = command();
    duplicate.criteria[1] = duplicate.criteria[0]!;
    expect(completionSchema.safeParse(duplicate).success).toBe(false);
    expect(completionSchema.safeParse({ ...command(), hasCriticalFailure: true }).success).toBe(
      false,
    );
    const missing = command();
    missing.criteria[0]!.evidence = " ";
    expect(completionSchema.safeParse(missing).success).toBe(false);
    const unknown = {
      ...command(),
      criteria: [{ id: "other", score: 3, evidence: "x" }, ...command().criteria.slice(1)],
    };
    expect(completionSchema.safeParse(unknown).success).toBe(false);
  });
  it.each([
    -1,
    4,
    2.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects invalid criterion score %s", (score) => {
    const invalid = command();
    invalid.criteria[0]!.score = score;
    expect(completionSchema.safeParse(invalid).success).toBe(false);
  });
  it("requires actionable feedback for revision", () => {
    expect(
      completionSchema.safeParse({ ...command(), decision: "revise_and_resubmit" }).success,
    ).toBe(false);
    expect(
      completionSchema.safeParse({
        ...command(),
        decision: "revise_and_resubmit",
        actionItems: ["Add evidence"],
      }).success,
    ).toBe(true);
  });
  it("hashes equivalent criterion order identically and distinguishes conflicting decisions", async () => {
    const original = completionSchema.parse(command());
    expect(await completionHash(original)).toBe(
      await completionHash({ ...original, criteria: [...original.criteria].reverse() }),
    );
    expect(await completionHash(original)).not.toBe(
      await completionHash({ ...original, feedback: "Changed" }),
    );
  });
});
