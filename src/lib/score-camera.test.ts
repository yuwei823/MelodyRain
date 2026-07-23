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
    expect(systemFollowingCameraOffset(anchors, 11, 800, 2_000)).toBe(100);
    expect(systemFollowingCameraOffset(anchors, 15.9, 800, 2_000)).toBe(100);
  });

  it("smoothly transitions after the active row changes", () => {
    expect(systemFollowingCameraOffset(anchors, 16, 800, 2_000)).toBe(100);
    expect(systemFollowingCameraOffset(anchors, 17, 800, 2_000)).toBe(300);
    expect(systemFollowingCameraOffset(anchors, 18, 800, 2_000)).toBe(500);
  });

  it("stops early when the complete score bottom is visible", () => {
    expect(systemFollowingCameraOffset(anchors, 27, 800, 1_600)).toBe(800);
    expect(systemFollowingCameraOffset(anchors, 30, 800, 1_600)).toBe(800);
  });

  it("does not scroll when the score fits in the viewport", () => {
    expect(systemFollowingCameraOffset(anchors, 20, 2_000, 1_600)).toBe(0);
  });

  it("uses rest height when computing the system vertical span", () => {
    // Piano grand staff: treble note near the top, bass rest near the bottom.
    const withRestHeight = [
      { scoreQuarter: 0, x: 50, y: 100, height: 8 },
      { scoreQuarter: 0, x: 50, y: 300, height: 40 },
    ];
    const withoutRestHeight = [
      { scoreQuarter: 0, x: 50, y: 100, height: 8 },
      { scoreQuarter: 0, x: 50, y: 300 },
    ];
    // viewport 300px, score 1000px -> must scroll.
    expect(systemFollowingCameraOffset(withRestHeight, 0, 300, 1_000)).toBe(70);
    // Without height the rest bottom is underestimated, so the offset is smaller.
    expect(systemFollowingCameraOffset(withoutRestHeight, 0, 300, 1_000)).toBe(50);
  });

  it("does not split one measure into multiple rows because of rest x position", () => {
    // A piano measure whose bass rest is horizontally far to the right of the
    // treble notes used to make the row detector think the notes started a new
    // row. The fix is to let callers omit rest anchors; here we verify the
    // resulting anchors produce a single stable row.
    const noteAnchors = [
      { scoreQuarter: 0, x: 100, y: 100, height: 8 },
      { scoreQuarter: 0.5, x: 120, y: 100, height: 8 },
      { scoreQuarter: 1, x: 140, y: 100, height: 8 },
    ];
    const withRestAnchors = [
      ...noteAnchors,
      { scoreQuarter: 0, x: 300, y: 300, height: 20 },
    ];
    // Notes alone form one row; offset stays stable across the measure.
    expect(systemFollowingCameraOffset(noteAnchors, 0.5, 300, 1_000))
      .toBe(systemFollowingCameraOffset(noteAnchors, 1, 300, 1_000));
    // With the rest included the first column shifts right, so the second
    // column looks like a new row and produces a different (wrong) offset.
    expect(systemFollowingCameraOffset(withRestAnchors, 0.5, 300, 1_000))
      .not.toBe(systemFollowingCameraOffset(withRestAnchors, 1, 300, 1_000));
  });
});
