import { describe, expect, it } from "vitest";
import { SCORE_CAMERA_FOCUS_RATIO, verticalCameraOffset } from "./score-camera";

const anchors = [
  { scoreQuarter: 0, x: 100, y: 120 },
  { scoreQuarter: 2, x: 280, y: 120 },
  { scoreQuarter: 4, x: 100, y: 520 },
  { scoreQuarter: 6, x: 280, y: 520 },
  { scoreQuarter: 8, x: 100, y: 860 },
  { scoreQuarter: 10, x: 280, y: 860 },
  { scoreQuarter: 12, x: 100, y: 1_220 },
];

describe("vertical score camera", () => {
  it("does not move before the active position reaches the configured focal line", () => {
    expect(verticalCameraOffset(anchors, 0, 600, 1_500)).toBe(0);
  });

  it("keeps the active system at the configured vertical focal line while score remains below", () => {
    expect(verticalCameraOffset(anchors, 8, 600, 1_500)).toBeCloseTo(860 - 600 / SCORE_CAMERA_FOCUS_RATIO);
  });

  it("accounts for content spacing inside the clipped viewport", () => {
    expect(verticalCameraOffset(anchors, 8, 600, 1_500, { contentTop: 32 }))
      .toBeCloseTo(32 + 860 - 600 / SCORE_CAMERA_FOCUS_RATIO);
  });

  it("does not move for each note within the same system", () => {
    expect(verticalCameraOffset(anchors, 8, 600, 1_500)).toBe(verticalCameraOffset(anchors, 10, 600, 1_500));
  });

  it("clamps at the score end so later notes naturally move toward the bottom", () => {
    expect(verticalCameraOffset(anchors, 12, 600, 1_500, { focusRatio: 10 })).toBe(900);
  });
});
