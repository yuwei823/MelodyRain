import { describe, expect, it } from "vitest";
import { preRollSourceTime, TRANSPORT_PRE_ROLL_MS } from "./transport";

describe("transport pre-roll", () => {
  it("advances from negative source time to the first audio frame", () => {
    expect(preRollSourceTime(0, 1)).toBe(-TRANSPORT_PRE_ROLL_MS);
    expect(preRollSourceTime(600, 1)).toBe(-600);
    expect(preRollSourceTime(1_200, 1)).toBe(0);
    expect(preRollSourceTime(1_500, 1)).toBe(0);
  });

  it("respects the selected playback rate", () => {
    expect(preRollSourceTime(1_200, 0.5)).toBe(-600);
    expect(preRollSourceTime(600, 2)).toBe(0);
  });
});
