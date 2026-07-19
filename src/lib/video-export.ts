import { TRANSPORT_PRE_ROLL_MS } from "./transport";

export const VIDEO_EXPORT_PROFILE = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  mimeType: "video/mp4",
  videoCodec: "avc1.640028",
});

export interface VideoExportFrame {
  index: number;
  sourceTimeMs: number;
  timestampUs: number;
}

export function videoExportFrameCount(
  durationMs: number,
  fps: number = VIDEO_EXPORT_PROFILE.fps,
): number {
  const safeDurationMs = Math.max(0, durationMs) + TRANSPORT_PRE_ROLL_MS;
  return Math.ceil((safeDurationMs * fps) / 1_000) + 1;
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

export function videoExportProgress(completedFrames: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  return Math.max(0, Math.min(1, completedFrames / totalFrames));
}
