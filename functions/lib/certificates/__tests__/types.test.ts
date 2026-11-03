import { expect, it } from "vitest";
import { atomicIssueResultSchema, certificateRowSchema } from "../types";
import { row } from "./fixtures";

it("rejects malformed database/RPC payloads at the runtime boundary", () => {
  expect(certificateRowSchema.parse(row)).toEqual(row);
  expect(atomicIssueResultSchema.parse({ certificate: row, created: false }).created).toBe(false);
  for (const value of [
    null,
    { certificate: null, created: true },
    { certificate: row, created: "yes" },
  ])
    expect(() => atomicIssueResultSchema.parse(value)).toThrow();
});
