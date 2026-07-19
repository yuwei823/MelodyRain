import type { MidiTimeline } from "./midi";
import { transportSnapshotAt, type TransportSnapshot } from "./transport";
import {
  VIDEO_EXPORT_PROFILE,
  videoExportFrame,
  videoExportFrameCount,
  videoExportProgress,
  type VideoExportFrame,
} from "./video-export";

export interface ExportCanvasRenderer {
  prepare(): Promise<void>;
  render(): Promise<HTMLCanvasElement>;
}

export interface VideoExportSessionOptions {
  timeline: MidiTimeline;
  durationMs: number;
  renderer: ExportCanvasRenderer;
  updateStage(snapshot: TransportSnapshot): void;
  consumeFrame(
    canvas: HTMLCanvasElement,
    frame: VideoExportFrame,
    snapshot: TransportSnapshot,
  ): void | Promise<void>;
  onProgress?(progress: number, completedFrames: number, totalFrames: number): void;
  signal?: AbortSignal;
  fps?: number;
}

export class VideoExportCancelledError extends Error {
  constructor() {
    super("Video export cancelled / 视频导出已取消");
    this.name = "VideoExportCancelledError";
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new VideoExportCancelledError();
}

export async function runVideoExportSession(options: VideoExportSessionOptions): Promise<number> {
  const fps = options.fps ?? VIDEO_EXPORT_PROFILE.fps;
  const totalFrames = videoExportFrameCount(options.durationMs, fps);
  throwIfCancelled(options.signal);
  await options.renderer.prepare();

  for (let index = 0; index < totalFrames; index += 1) {
    throwIfCancelled(options.signal);
    const frame = videoExportFrame(index, fps);
    const snapshot = transportSnapshotAt(
      options.timeline,
      frame.sourceTimeMs,
      options.durationMs,
      1,
      "playing",
    );
    options.updateStage(snapshot);
    await Promise.resolve();
    throwIfCancelled(options.signal);
    const canvas = await options.renderer.render();
    await options.consumeFrame(canvas, frame, snapshot);
    const completedFrames = index + 1;
    options.onProgress?.(
      videoExportProgress(completedFrames, totalFrames),
      completedFrames,
      totalFrames,
    );
  }

  return totalFrames;
}
