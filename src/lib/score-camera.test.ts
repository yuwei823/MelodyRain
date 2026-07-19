import { describe, expect, it } from "vitest";
import { uniformVerticalCameraOffset } from "./score-camera";

describe("uniform vertical score camera", () => {
  it("moves linearly over the complete playback duration", () => {
    expect(uniformVerticalCameraOffset(2_000, 2_000, 8_000, 600, 1_500)).toBe(0);
    expect(uniformVerticalCameraOffset(3_500, 2_000, 8_000, 600, 1_500)).toBe(225);
    expect(uniformVerticalCameraOffset(5_000, 2_000, 8_000, 600, 1_500)).toBe(450);
    expect(uniformVerticalCameraOffset(8_000, 2_000, 8_000, 600, 1_500)).toBe(900);
  });

  it("clamps before playback and after the score ends", () => {
    expect(uniformVerticalCameraOffset(1_000, 2_000, 8_000, 600, 1_500)).toBe(0);
    expect(uniformVerticalCameraOffset(10_000, 2_000, 8_000, 600, 1_500)).toBe(900);
  });

  it("does not move when scrolling is unnecessary or timing is unavailable", () => {
    expect(uniformVerticalCameraOffset(5_000, 2_000, 8_000, 600, 500)).toBe(0);
    expect(uniformVerticalCameraOffset(5_000, 2_000, 2_000, 600, 1_500)).toBe(0);
  });
});
