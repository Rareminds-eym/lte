import { expect, it } from "vitest";
import { resolveLearnerName } from "../learnerName";

it("normalizes human names, bounds length and never derives them from email", () => {
  expect(resolveLearnerName({})).toBeNull();
  expect(resolveLearnerName({ first_name: " \n", last_name: null })).toBeNull();
  expect(resolveLearnerName({ first_name: "  Ada \n Marie ", last_name: " Lovelace " })).toBe(
    "Ada Marie Lovelace",
  );
  expect(resolveLearnerName({ first_name: "x".repeat(300) })?.length).toBe(255);
});
