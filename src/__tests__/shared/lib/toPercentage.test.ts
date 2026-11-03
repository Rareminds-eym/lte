import { describe, expect, it } from "vitest";
import { toPercentage } from "@/shared/lib";

describe("toPercentage", () => {
  it.each([
    [42.5, 42.5],
    [-1, 0],
    [150, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("bounds %s to a valid accessible percentage %s", (input, expected) =>
    expect(toPercentage(input)).toBe(expected));
});
