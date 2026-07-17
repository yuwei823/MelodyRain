import { describe, expect, it } from "vitest";
import { growingSpanProgress, revealProgress, tieContinuationVisible } from "./score-timeline-layer";

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

  it("shows a tie continuation directly at its written start", () => {
    expect(tieContinuationVisible(1_999, 2_000)).toBe(false);
    expect(tieContinuationVisible(2_000, 2_000)).toBe(true);
  });
});
