import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_RAINBOW_PALETTE,
  normalizedGradientStops,
  pitchStepFromFundamentalNote,
  stemOwnerTarget,
  type PerformancePitchTarget,
} from "./performance-effect-layer";

function target(pitchMidi: number, pitchStep: PerformancePitchTarget["pitchStep"], direction: "up" | "down") {
  return { pitchMidi, pitchStep, stemDirection: direction } satisfies PerformancePitchTarget;
}

describe("performance rainbow pitch mapping", () => {
  it("uses the written diatonic step rather than the chromatic accidental", () => {
    expect([0, 2, 4, 5, 7, 9, 11].map(pitchStepFromFundamentalNote)).toEqual([
      "C", "D", "E", "F", "G", "A", "B",
    ]);
    expect(PERFORMANCE_RAINBOW_PALETTE.G).toBe("#1CAEE8");
    expect(PERFORMANCE_RAINBOW_PALETTE.B).toBe("#8357DF");
  });

  it("uses the lowest pitch for an up-stem chord", () => {
    expect(stemOwnerTarget([
      target(67, "G", "up"),
      target(60, "C", "up"),
      target(64, "E", "up"),
    ])?.pitchStep).toBe("C");
  });

  it("uses the highest pitch for a down-stem chord", () => {
    expect(stemOwnerTarget([
      target(67, "G", "down"),
      target(60, "C", "down"),
      target(64, "E", "down"),
    ])?.pitchStep).toBe("G");
  });

  it("places beam gradient stops at normalized stem positions", () => {
    expect(normalizedGradientStops([
      { position: 100, color: "red" },
      { position: 250, color: "blue" },
      { position: 400, color: "purple" },
    ])).toEqual([
      { offset: 0, color: "red" },
      { offset: 0.5, color: "blue" },
      { offset: 1, color: "purple" },
    ]);
  });
});
