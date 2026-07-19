import { describe, expect, it } from "vitest";
import { TRANSPORT_PRE_ROLL_MS } from "./transport";
import { VIDEO_EXPORT_PROFILES, videoExportFrame, videoExportFrameCount, videoExportProgress } from "./video-export";

describe("video export timeline", () => {
  it("provides standard and high-quality portrait profiles", () => {
    expect(VIDEO_EXPORT_PROFILES.standard).toMatchObject({ width: 540, height: 960, fps: 30 });
    expect(VIDEO_EXPORT_PROFILES.high).toMatchObject({ width: 1080, height: 1920, fps: 30 });
  });

  it("starts at the animation pre-roll and reaches source time zero exactly", () => {
    expect(videoExportFrame(0).sourceTimeMs).toBe(-TRANSPORT_PRE_ROLL_MS);
    expect(videoExportFrame(36).sourceTimeMs).toBe(0);
    expect(videoExportFrame(36).timestampUs).toBe(1_200_000);
  });

  it("includes pre-roll in the total deterministic frame count", () => {
    expect(videoExportFrameCount(10_000)).toBe(337);
  });

  it("clamps progress to the valid range", () => {
    expect(videoExportProgress(-1, 100)).toBe(0);
    expect(videoExportProgress(25, 100)).toBe(0.25);
    expect(videoExportProgress(101, 100)).toBe(1);
  });
});
