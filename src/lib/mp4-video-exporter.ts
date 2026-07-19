import { ExportFrameRenderer } from "./export-frame-renderer";
import { MidiTimeline } from "./midi";
import { TRANSPORT_PRE_ROLL_MS, type TransportSnapshot } from "./transport";
import { VIDEO_EXPORT_PROFILE } from "./video-export";
import { runVideoExportSession } from "./video-export-session";

export interface Mp4VideoExportOptions {
  frameElement: HTMLElement;
  audioUrl: string;
  midi: ConstructorParameters<typeof MidiTimeline>[0];
  durationMs: number;
  updateStage(snapshot: TransportSnapshot): void;
  onProgress?(progress: number): void;
  onPhase?(phase: "preparing" | "rendering" | "finalizing"): void;
  signal?: AbortSignal;
}

async function decodedAudio(audioUrl: string): Promise<{ context: AudioContext; buffer: AudioBuffer }> {
  const context = new AudioContext();
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Unable to read audio (${response.status}) / 无法读取音频`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    return { context, buffer };
  } catch (error) {
    await context.close();
    throw error;
  }
}

function silenceBeforeAudio(context: AudioContext, audio: AudioBuffer): AudioBuffer {
  const frames = Math.ceil((TRANSPORT_PRE_ROLL_MS / 1_000) * audio.sampleRate);
  return context.createBuffer(audio.numberOfChannels, frames, audio.sampleRate);
}

export async function encodeMp4Video(options: Mp4VideoExportOptions): Promise<Blob> {
  options.onPhase?.("preparing");
  const {
    AudioBufferSource,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    canEncodeAudio,
    canEncodeVideo,
  } = await import("mediabunny");
  const videoSupported = await canEncodeVideo("avc", {
    width: VIDEO_EXPORT_PROFILE.width,
    height: VIDEO_EXPORT_PROFILE.height,
    bitrate: 8_000_000,
  });
  if (!videoSupported) {
    throw new Error("H.264 encoding is not supported by this browser / 当前浏览器不支持 H.264 编码");
  }
  const renderer = new ExportFrameRenderer(options.frameElement);
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const videoSource = new CanvasSource(renderer.canvas, {
    codec: "avc",
    bitrate: 8_000_000,
    keyFrameInterval: 2,
    latencyMode: "quality",
  });
  const audioSource = new AudioBufferSource({
    codec: "aac",
    bitrate: 192_000,
  });
  output.addVideoTrack(videoSource, { name: "MelodyRain video" });
  output.addAudioTrack(audioSource, { name: "MelodyRain audio" });

  const { context, buffer: audioBuffer } = await decodedAudio(options.audioUrl);
  try {
    const audioSupported = await canEncodeAudio("aac", {
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      bitrate: 192_000,
    });
    if (!audioSupported) {
      throw new Error("AAC encoding is not supported by this browser / 当前浏览器不支持 AAC 编码");
    }
    await output.start();
    await audioSource.add(silenceBeforeAudio(context, audioBuffer));
    await audioSource.add(audioBuffer);
    options.onPhase?.("rendering");
    await runVideoExportSession({
      timeline: new MidiTimeline(options.midi),
      durationMs: options.durationMs,
      renderer,
      updateStage: options.updateStage,
      consumeFrame: async (_canvas, frame) => {
        await videoSource.add(
          frame.timestampUs / 1_000_000,
          1 / VIDEO_EXPORT_PROFILE.fps,
        );
      },
      onProgress: options.onProgress,
      signal: options.signal,
    });
    options.onPhase?.("finalizing");
    await output.finalize();
    if (!target.buffer) throw new Error("MP4 output is empty / MP4 输出为空");
    return new Blob([target.buffer], { type: VIDEO_EXPORT_PROFILE.mimeType });
  } catch (error) {
    if (output.state === "started" || output.state === "finalizing") await output.cancel();
    throw error;
  } finally {
    await context.close();
  }
}

export function downloadVideoBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
