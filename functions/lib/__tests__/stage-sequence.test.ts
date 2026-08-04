import { describe, expect, it } from "vitest";
import { assertStageSequenceAllowed, StageSequenceError } from "../stage-sequence";

describe("assertStageSequenceAllowed", () => {
  it("allows the first incomplete stage", () => {
    expect(() => assertStageSequenceAllowed("explain", ["engage", "explore"])).not.toThrow();
  });

  it("allows revisiting a completed stage", () => {
    expect(() => assertStageSequenceAllowed("engage", ["engage", "explore"])).not.toThrow();
  });

  it("blocks future stages when previous stages are incomplete", () => {
    expect(() => assertStageSequenceAllowed("evolve", ["engage"])).toThrow(StageSequenceError);
  });

  it("rejects invalid stage names", () => {
    expect(() => assertStageSequenceAllowed("invalid", [])).toThrow("Invalid stage name");
  });
});
