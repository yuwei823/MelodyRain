import { TRANSPORT_PRE_ROLL_MS } from "./transport.js";

export type VideoExportQuality = "high" | "standard";

// Shared with src/server/video-export.ts: keep both in sync so the server
// never rejects a frame range the client considers valid.
export const VIDEO_EXPORT_FPS = 30;
export const VIDEO_EXPORT_PRE_ROLL_MS = TRANSPORT_PRE_ROLL_MS;

export function videoExportFullFrameCount(
  durationMs: number,
  fps: number = VIDEO_EXPORT_FPS,
  preRollMs: number = VIDEO_EXPORT_PRE_ROLL_MS,
): number {
  const safeDurationMs = Math.max(0, durationMs) + preRollMs;
  return Math.ceil((safeDurationMs * fps) / 1_000) + 1;
}

export const VIDEO_EXPORT_PROFILES = Object.freeze({
  high: Object.freeze({ width: 1080, height: 1920, fps: VIDEO_EXPORT_FPS, label: "High / 高清" }),
  standard: Object.freeze({ width: 540, height: 960, fps: VIDEO_EXPORT_FPS, label: "Standard / 普通" }),
});

export const VIDEO_EXPORT_PROFILE = VIDEO_EXPORT_PROFILES.high;

export interface VideoExportFrame {
  index: number;
  sourceTimeMs: number;
  timestampUs: number;
}

export interface VideoExportFrameRange {
  startFrame: number;
  endFrame: number;
}

export function videoExportFrameCount(
  durationMs: number,
  fps: number = VIDEO_EXPORT_PROFILE.fps,
): number {
  return videoExportFullFrameCount(durationMs, fps, TRANSPORT_PRE_ROLL_MS);
}

export function videoExportFrame(
  index: number,
  fps: number = VIDEO_EXPORT_PROFILE.fps,
): VideoExportFrame {
  const safeIndex = Math.max(0, Math.floor(index));
  const presentationTimeMs = (safeIndex * 1_000) / fps;
  return {
    index: safeIndex,
    sourceTimeMs: presentationTimeMs - TRANSPORT_PRE_ROLL_MS,
    timestampUs: Math.round(presentationTimeMs * 1_000),
  };
}

export function videoExportCurrentFrame(
  sourceTimeMs: number,
  totalFrames: number,
  fps: number = VIDEO_EXPORT_PROFILE.fps,
): number {
  if (totalFrames <= 0) return 0;
  const presentationTimeMs = Math.max(0, sourceTimeMs + TRANSPORT_PRE_ROLL_MS);
  return Math.min(totalFrames - 1, Math.floor((presentationTimeMs * fps) / 1_000));
}

export function validVideoExportFrameRange(
  range: VideoExportFrameRange,
  totalFrames: number,
): boolean {
  return Number.isInteger(range.startFrame)
    && Number.isInteger(range.endFrame)
    && range.startFrame >= 0
    && range.startFrame < range.endFrame
    && range.endFrame <= totalFrames;
}

export function videoExportProgress(completedFrames: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  return Math.max(0, Math.min(1, completedFrames / totalFrames));
}
