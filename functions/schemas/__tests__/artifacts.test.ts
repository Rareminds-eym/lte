import { ARTIFACT_LIMITS } from "@functions/lib/artifact-evaluator";
import { describe, expect, it } from "vitest";
import { completeSubmissionSchema, uuidSchema } from "../artifacts";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("uuidSchema", () => {
  it("accepts a valid UUID", () => {
    expect(uuidSchema.safeParse(UUID_A).success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(uuidSchema.safeParse(123).success).toBe(false);
  });
});

describe("completeSubmissionSchema", () => {
  const validInput = {
    artifact_id: UUID_A,
    answers: [{ question_id: UUID_B, text_response: "All done." }],
  };

  it("accepts a valid submission with text, url and file-only answers", () => {
    expect(completeSubmissionSchema.safeParse(validInput).success).toBe(true);
    expect(
      completeSubmissionSchema.safeParse({
        artifact_id: UUID_A,
        answers: [
          { question_id: UUID_B, url_response: "https://example.com/artifact" },
          { question_id: UUID_A },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects a missing artifact_id", () => {
    const result = completeSubmissionSchema.safeParse({
      answers: [{ question_id: UUID_B }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid artifact_id", () => {
    expect(
      completeSubmissionSchema.safeParse({
        artifact_id: "not-a-uuid",
        answers: [{ question_id: UUID_B }],
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid question_id", () => {
    expect(
      completeSubmissionSchema.safeParse({
        artifact_id: UUID_A,
        answers: [{ question_id: "nope" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty answers array", () => {
    expect(completeSubmissionSchema.safeParse({ artifact_id: UUID_A, answers: [] }).success).toBe(
      false,
    );
  });

  it("rejects more than maxAnswersPerSubmission answers", () => {
    const answers = Array.from({ length: ARTIFACT_LIMITS.maxAnswersPerSubmission + 1 }, (_, i) => ({
      question_id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`,
    }));
    const result = completeSubmissionSchema.safeParse({ artifact_id: UUID_A, answers });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Too many answers in one submission.");
  });

  it("rejects a text response longer than textResponseMaxChars", () => {
    const result = completeSubmissionSchema.safeParse({
      artifact_id: UUID_A,
      answers: [
        {
          question_id: UUID_B,
          text_response: "a".repeat(ARTIFACT_LIMITS.textResponseMaxChars + 1),
        },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Text response is too long.");
  });

  it("rejects an invalid url_response", () => {
    expect(
      completeSubmissionSchema.safeParse({
        artifact_id: UUID_A,
        answers: [{ question_id: UUID_B, url_response: "not-a-url" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a url_response longer than urlResponseMaxChars", () => {
    const longUrl = `https://example.com/${"a".repeat(ARTIFACT_LIMITS.urlResponseMaxChars)}`;
    const result = completeSubmissionSchema.safeParse({
      artifact_id: UUID_A,
      answers: [{ question_id: UUID_B, url_response: longUrl }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("URL response is too long.");
  });
});
