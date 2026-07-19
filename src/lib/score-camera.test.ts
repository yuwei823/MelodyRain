import { describe, expect, it } from "vitest";
import { systemFollowingCameraOffset } from "./score-camera";

const anchors = [
  { scoreQuarter: 0, x: 20, y: 100 },
  { scoreQuarter: 4, x: 120, y: 100 },
  { scoreQuarter: 8, x: 20, y: 500 },
  { scoreQuarter: 12, x: 120, y: 500 },
  { scoreQuarter: 16, x: 20, y: 900 },
  { scoreQuarter: 20, x: 120, y: 900 },
  { scoreQuarter: 24, x: 20, y: 1_300 },
];

describe("score-system-following vertical camera", () => {
  it("does not move before the active row reaches the vertical center", () => {
    expect(systemFollowingCameraOffset(anchors, 0, 800, 2_000)).toBe(0);
    expect(systemFollowingCameraOffset(anchors, 7.9, 800, 2_000)).toBe(0);
  });

  it("centers the active row and remains stable while that row is playing", () => {
    expect(systemFollowingCameraOffset(anchors, 8.5, 800, 2_000)).toBe(100);
    expect(systemFollowingCameraOffset(anchors, 12, 800, 2_000)).toBe(100);
  });

  it("smoothly transitions after the active row changes", () => {
    expect(systemFollowingCameraOffset(anchors, 16, 800, 2_000)).toBe(100);
    expect(systemFollowingCameraOffset(anchors, 16.25, 800, 2_000)).toBe(300);
    expect(systemFollowingCameraOffset(anchors, 16.5, 800, 2_000)).toBe(500);
  });

  it("stops early when the complete score bottom is visible", () => {
    expect(systemFollowingCameraOffset(anchors, 24.5, 800, 1_600)).toBe(800);
    expect(systemFollowingCameraOffset(anchors, 30, 800, 1_600)).toBe(800);
  });

  it("does not scroll when the score fits in the viewport", () => {
    expect(systemFollowingCameraOffset(anchors, 20, 2_000, 1_600)).toBe(0);
  });
});
