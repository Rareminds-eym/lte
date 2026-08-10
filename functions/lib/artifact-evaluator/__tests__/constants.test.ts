import { describe, expect, it } from "vitest";
import { ARTIFACT_LIMITS } from "../constants";

describe("ARTIFACT_LIMITS", () => {
  it("pins the fixed caps that schemas and guards depend on", () => {
    expect(ARTIFACT_LIMITS.textResponseMaxChars).toBe(20_000);
    expect(ARTIFACT_LIMITS.urlResponseMaxChars).toBe(2_048);
    expect(ARTIFACT_LIMITS.fileNameMaxChars).toBe(255);
    expect(ARTIFACT_LIMITS.maxAnswersPerSubmission).toBe(20);
    expect(ARTIFACT_LIMITS.maxFilesPerSubmission).toBe(10);
    expect(ARTIFACT_LIMITS.maxRequestBytes).toBe(25 * 1024 * 1024);
    expect(ARTIFACT_LIMITS.rateLimitMax).toBe(10);
    expect(ARTIFACT_LIMITS.rateLimitWindowMs).toBe(60_000);
  });
});
