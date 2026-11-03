import { summary } from "@functions/lib/certificates";
import { env, row } from "@functions/lib/certificates/__tests__/fixtures";
import { expect, it } from "vitest";
import { certificateSummarySchema, listQuerySchema, verifyResponseSchema } from "../certificates";

it("validates filters and rejects unknown parameters", () => {
  expect(listQuerySchema.parse({})).toEqual({});
  expect(listQuerySchema.safeParse({ type: "unsupported" }).success).toBe(false);
  expect(listQuerySchema.safeParse({ userId: row.user_id }).success).toBe(false);
});
it("validates learner and public response contracts", () => {
  expect(certificateSummarySchema.parse(summary(row, env)).credentialId).toBe(row.credential_id);
  expect(
    verifyResponseSchema.safeParse({ status: "valid", credentialId: row.credential_id }).success,
  ).toBe(false);
  expect(
    verifyResponseSchema.parse({
      status: "not_found",
      credentialId: row.credential_id,
      issuer: "Rareminds LTE",
    }).status,
  ).toBe("not_found");
});
