import { describe, expect, it } from "vitest";
import { resolveFrameColorConfig, validFrameColorRanges, type FrameColorRangeSettings } from "./frame-color-ranges";
import type { PerformanceEffectConfig } from "./performance-effect-layer";

const GLOBAL: PerformanceEffectConfig = { mode: "mask", mixColor: "#000000", mixAmount: 1 };
const SETTINGS: FrameColorRangeSettings = {
  transitionFrames: 15,
  ranges: [{ id: "chorus", startFrame: 30, endFrame: 60, mode: "solid", color: "#FFFFFF" }],
};

describe("frame color ranges", () => {
  it("uses deterministic 15-frame interpolation between two ranges", () => {
    const twoRanges: FrameColorRangeSettings = {
      ...SETTINGS,
      ranges: [
        { id: "intro", startFrame: 0, endFrame: 30, mode: "solid", color: "#000000" },
        SETTINGS.ranges[0]!,
      ],
    };
    expect(resolveFrameColorConfig(29, GLOBAL, twoRanges)).toMatchObject({ mode: "mask", mixColor: "#000000" });
    expect(resolveFrameColorConfig(30, GLOBAL, twoRanges)).toMatchObject({ mode: "mask", mixColor: "#111111" });
    expect(resolveFrameColorConfig(44, GLOBAL, twoRanges)).toMatchObject({ mode: "mask", mixColor: "#FFFFFF" });
  });

  it("extends the first range backward instead of using a global fallback", () => {
    expect(resolveFrameColorConfig(0, GLOBAL, SETTINGS)).toMatchObject({ mode: "mask", mixColor: "#FFFFFF" });
  });

  it("supports transitions between solid and rainbow palettes", () => {
    const rainbow = { ...SETTINGS, ranges: [{ ...SETTINGS.ranges[0]!, mode: "rainbow" as const }] };
    expect(resolveFrameColorConfig(44, GLOBAL, rainbow).palette?.C).toBe("#F05D6C");
  });

  it("passes global mix strength to the original mask overlay", () => {
    const halfStrength = resolveFrameColorConfig(44, { ...GLOBAL, mixAmount: 0.5 }, SETTINGS);
    expect(halfStrength).toMatchObject({ mode: "mask", mixColor: "#FFFFFF", mixAmount: 0.5 });
  });

  it("does not apply global mix strength to rainbow ranges", () => {
    const rainbow = { ...SETTINGS, ranges: [{ ...SETTINGS.ranges[0]!, mode: "rainbow" as const }] };
    const lowStrength = resolveFrameColorConfig(44, { ...GLOBAL, mixAmount: 0.1 }, rainbow);
    expect(lowStrength).toMatchObject({ mode: "rainbow" });
    expect(lowStrength.palette?.C).toBe("#F05D6C");
    expect(lowStrength.mixAmount).toBe(1);
  });

  it("switches renderers directly between solid mask and rainbow to preserve exact endpoints", () => {
    const rainbow = { ...SETTINGS, ranges: [{ ...SETTINGS.ranges[0]!, mode: "rainbow" as const }] };
    expect(resolveFrameColorConfig(30, GLOBAL, rainbow).mode).toBe("rainbow");
    expect(resolveFrameColorConfig(60, GLOBAL, rainbow).mode).toBe("rainbow");
  });

  it("blends solid into rainbow across the transition frames", () => {
    const settings: FrameColorRangeSettings = {
      transitionFrames: 15,
      ranges: [
        { id: "intro", startFrame: 0, endFrame: 30, mode: "solid", color: "#000000" },
        { id: "chorus", startFrame: 30, endFrame: 60, mode: "rainbow", color: "#000000" },
      ],
    };
    const half = { ...GLOBAL, mixAmount: 0.5 };
    expect(resolveFrameColorConfig(29, half, settings)).toMatchObject({ mode: "mask", mixColor: "#000000" });
    const start = resolveFrameColorConfig(30, half, settings);
    expect(start.mode).toBe("rainbow");
    expect(start.palette?.C).toBe("#100607");
    expect(start.mixAmount).toBeCloseTo(0.5 + 0.5 / 15, 5);
    expect(resolveFrameColorConfig(37, half, settings).palette?.C).toBe("#80323A");
    const settled = resolveFrameColorConfig(44, half, settings);
    expect(settled.mode).toBe("rainbow");
    expect(settled.palette?.C).toBe("#F05D6C");
    expect(settled.mixAmount).toBe(1);
  });

  it("blends rainbow into solid across the transition frames and settles on the mask renderer", () => {
    const settings: FrameColorRangeSettings = {
      transitionFrames: 15,
      ranges: [
        { id: "intro", startFrame: 0, endFrame: 30, mode: "rainbow", color: "#FFFFFF" },
        { id: "chorus", startFrame: 30, endFrame: 60, mode: "solid", color: "#FFFFFF" },
      ],
    };
    const half = { ...GLOBAL, mixAmount: 0.5 };
    const start = resolveFrameColorConfig(30, half, settings);
    expect(start.mode).toBe("rainbow");
    expect(start.palette?.C).toBe("#F16876");
    expect(start.mixAmount).toBeCloseTo(1 - 0.5 / 15, 5);
    expect(resolveFrameColorConfig(44, half, settings)).toMatchObject({ mode: "mask", mixColor: "#FFFFFF", mixAmount: 0.5 });
  });

  it("carries the latest range setting through gaps and to the final frame", () => {
    expect(resolveFrameColorConfig(75, GLOBAL, SETTINGS)).toMatchObject({
      mode: "mask",
      mixColor: "#FFFFFF",
    });
  });

  it("rejects overlapping or out-of-bounds ranges", () => {
    expect(validFrameColorRanges([
      { id: "a", startFrame: 0, endFrame: 20, mode: "solid", color: "#000000" },
      { id: "b", startFrame: 10, endFrame: 30, mode: "rainbow", color: "#000000" },
    ], 100)).toBe(false);
    expect(validFrameColorRanges([{ ...SETTINGS.ranges[0]!, endFrame: 101 }], 100)).toBe(false);
  });
});
