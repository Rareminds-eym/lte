import { describe, expect, it } from "vitest";
import { issueExecutionAssertion } from "../assertion";

const SECRET = "lte-assertion-secret-min-32-chars-00";

function decodePayload(assertion: string): Record<string, unknown> {
  const [, payload] = assertion.split(".");
  const b64 = (payload ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as Record<string, unknown>;
}

describe("issueExecutionAssertion", () => {
  it("mints v1 assertions the worker verifier accepts structurally", async () => {
    const assertion = await issueExecutionAssertion(
      SECRET,
      {
        issuer: "lte",
        action: "seniorEducator.grade-submission",
        userId: "u-9",
        product: "lte",
        entitlements: ["artifact_evaluation"],
      },
      1_700_000_000_000,
    );
    expect(assertion.startsWith("v1.")).toBe(true);
    expect(assertion.split(".")).toHaveLength(3);
    expect(decodePayload(assertion)).toMatchObject({
      issuer: "lte",
      audience: "ai-api",
      action: "seniorEducator.grade-submission",
      userId: "u-9",
      product: "lte",
      entitlements: ["artifact_evaluation"],
      issuedAt: 1_700_000_000_000,
      expiresAt: 1_700_000_060_000,
    });
  });

  it("rejects short secrets before minting", async () => {
    await expect(
      issueExecutionAssertion("short", {
        issuer: "lte",
        action: "seniorEducator.grade-submission",
        userId: "u-9",
        product: "lte",
        entitlements: [],
      }),
    ).rejects.toThrow("at least 32 characters");
  });
});
