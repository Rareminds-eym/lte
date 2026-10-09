import { expect, it } from "vitest";
import {
  certificateFiltersSchema,
  certificateListSchema,
  certificateSchema,
} from "@/entities/certificate";
import { certificate } from "../testSupport";

it("validates certificate identity, enums, dates, and optional filters", () => {
  expect(certificateSchema.parse(certificate)).toEqual(certificate);
  expect(certificateListSchema.parse({ certificates: [] })).toEqual({ certificates: [] });
  for (const patch of [
    { credentialId: "bad" },
    { status: "active" },
    { completionDate: "yesterday" },
    { levelId: "bad" },
    { verifyUrl: "not a url" },
    { verifyUrl: "javascript:alert(1)" },
  ])
    expect(() => certificateSchema.parse({ ...certificate, ...patch })).toThrow();
  expect(() => certificateFiltersSchema.parse({ type: "other" })).toThrow();
  expect(() => certificateFiltersSchema.parse({ injected: "value" })).toThrow();
});
