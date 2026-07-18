import { describe, expect, it } from "vitest";
import { growingSpanProgress, revealProgress } from "./score-timeline-layer";

describe("score timeline progress", () => {
  it("fades score annotations in over 300 milliseconds", () => {
    expect(revealProgress(999, 1_000)).toBe(0);
    expect(revealProgress(1_150, 1_000)).toBeCloseTo(0.5);
    expect(revealProgress(1_300, 1_000)).toBe(1);
  });

  it("grows a connecting span from its first to final note", () => {
    expect(growingSpanProgress(900, 1_000, 2_000)).toBe(0);
    expect(growingSpanProgress(1_500, 1_000, 2_000)).toBeCloseTo(0.5);
    expect(growingSpanProgress(2_000, 1_000, 2_000)).toBe(1);
  });
});
