import {
  PERFORMANCE_RAINBOW_PALETTE,
  type PerformanceEffectConfig,
  type PitchStep,
} from "./performance-effect-layer";

export const DEFAULT_FRAME_COLOR_TRANSITION_FRAMES = 60;

export type FrameColorMode = "solid" | "rainbow";

export interface FrameColorRange {
  id: string;
  startFrame: number;
  endFrame: number;
  mode: FrameColorMode;
  color: string;
}

export interface FrameColorRangeSettings {
  transitionFrames: number;
  ranges: FrameColorRange[];
}

type Palette = Record<PitchStep, string>;

function rgb(color: string): [number, number, number] {
  const value = color.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function mixHexColors(from: string, to: string, progress: number): string {
  const amount = Math.max(0, Math.min(1, progress));
  const start = rgb(from);
  const end = rgb(to);
  return `#${start.map((channel, index) => Math.round(channel + (end[index]! - channel) * amount)
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function palette(mode: FrameColorMode, color: string): Palette {
  return Object.fromEntries((Object.keys(PERFORMANCE_RAINBOW_PALETTE) as PitchStep[]).map((step) => [
    step,
    mode === "rainbow" ? PERFORMANCE_RAINBOW_PALETTE[step] : color,
  ])) as Palette;
}

// Callers (useScoreStage, resolveFrameColorConfig) hit this from the rAF hot
// path, so keep the sorted order memoized per settings object instead of
// re-sorting and reallocating on every frame.
const sortedRangeIndex = new WeakMap<FrameColorRange[], FrameColorRange[]>();

function sortedRanges(ranges: FrameColorRange[]): FrameColorRange[] {
  let ordered = sortedRangeIndex.get(ranges);
  if (!ordered) {
    ordered = [...ranges].sort((left, right) => left.startFrame - right.startFrame);
    sortedRangeIndex.set(ranges, ordered);
  }
  return ordered;
}

function styleAt(frame: number, globalConfig: PerformanceEffectConfig, ranges: FrameColorRange[]) {
  const ordered = sortedRanges(ranges);
  const range = ordered.find((candidate) => frame >= candidate.startFrame && frame < candidate.endFrame)
    ?? lastStartedAtOrBefore(ordered, frame)
    ?? ordered[0];
  return range
    ? { mode: range.mode, color: range.color }
    : { mode: globalConfig.mode === "rainbow" ? "rainbow" as const : "solid" as const, color: globalConfig.mixColor };
}

function lastStartedAtOrBefore(ordered: FrameColorRange[], frame: number): FrameColorRange | undefined {
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const candidate = ordered[index]!;
    if (candidate.startFrame <= frame) return candidate;
  }
  return undefined;
}

function sameStyle(left: ReturnType<typeof styleAt>, right: ReturnType<typeof styleAt>): boolean {
  return left.mode === right.mode && (left.mode === "rainbow" || left.color === right.color);
}

export function validFrameColorRanges(ranges: FrameColorRange[], totalFrames: number): boolean {
  const ordered = [...ranges].sort((left, right) => left.startFrame - right.startFrame);
  return ordered.every((range, index) => Number.isInteger(range.startFrame)
    && Number.isInteger(range.endFrame)
    && range.startFrame >= 0
    && range.startFrame < range.endFrame
    && range.endFrame <= totalFrames
    && (index === 0 || ordered[index - 1]!.endFrame <= range.startFrame));
}

export function resolveFrameColorConfig(
  frame: number,
  globalConfig: PerformanceEffectConfig,
  settings: FrameColorRangeSettings,
): PerformanceEffectConfig {
  const ranges = settings.ranges;
  const current = styleAt(frame, globalConfig, ranges);
  const boundaries: number[] = [];
  for (const range of ranges) {
    if (range.startFrame <= frame) boundaries.push(range.startFrame);
    if (range.endFrame <= frame) boundaries.push(range.endFrame);
  }
  boundaries.sort((left, right) => right - left);
  const boundary = boundaries.find((candidate) => candidate > 0
    && !sameStyle(styleAt(candidate - 1, globalConfig, ranges), styleAt(candidate, globalConfig, ranges)));
  const transitionFrames = Math.max(0, Math.floor(settings.transitionFrames));
  const progress = boundary === undefined || transitionFrames === 0
    ? 1
    : Math.min(1, (frame - boundary + 1) / transitionFrames);
  const previous = boundary === undefined ? current : styleAt(boundary - 1, globalConfig, ranges);
  if (previous.mode !== current.mode) {
    return current.mode === "solid"
      ? { mode: "mask", mixColor: current.color, mixAmount: globalConfig.mixAmount }
      : {
        mode: "rainbow",
        mixColor: current.color,
        mixAmount: globalConfig.mixAmount,
        palette: palette("rainbow", current.color),
      };
  }
  if (current.mode === "solid") {
    return {
      mode: "mask",
      mixColor: mixHexColors(previous.color, current.color, progress),
      mixAmount: globalConfig.mixAmount,
    };
  }
  const fromPalette = palette(previous.mode, previous.color);
  const toPalette = palette(current.mode, current.color);
  const resolvedPalette = Object.fromEntries((Object.keys(toPalette) as PitchStep[])
    .map((step) => [step, mixHexColors(fromPalette[step], toPalette[step], progress)])) as Palette;
  return {
    mode: "rainbow",
    mixColor: current.color,
    mixAmount: globalConfig.mixAmount,
    palette: resolvedPalette,
  };
}
