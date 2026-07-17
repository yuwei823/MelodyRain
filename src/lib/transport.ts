import type { MidiTimeline } from "./midi";

export type TransportState = "idle" | "playing" | "paused" | "ended";

export interface TransportSnapshot {
  state: TransportState;
  presentationTimeMs: number;
  sourceTimeMs: number;
  durationMs: number;
  scoreQuarter: number;
  tempoScale: number;
  effectiveBpm: number;
  progress: number;
  activeNoteIds: string[];
}

export type TransportListener = (snapshot: TransportSnapshot) => void;

export class MediaTransport {
  readonly audio: HTMLAudioElement;

  private listeners = new Set<TransportListener>();
  private animationFrame: number | null = null;
  private state: TransportState = "idle";

  constructor(audio: HTMLAudioElement, private readonly timeline: MidiTimeline) {
    this.audio = audio;
    this.audio.preload = "metadata";
    this.audio.preservesPitch = true;
    this.audio.addEventListener("play", this.onPlay);
    this.audio.addEventListener("pause", this.onPause);
    this.audio.addEventListener("ended", this.onEnded);
    this.audio.addEventListener("loadedmetadata", this.emit);
    this.audio.addEventListener("seeked", this.emit);
  }

  subscribe(listener: TransportListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async toggle(): Promise<void> {
    if (this.audio.paused) {
      if (this.audio.ended) this.audio.currentTime = 0;
      await this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  rewind(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.state = "idle";
    this.emit();
  }

  seek(progress: number): void {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.audio.currentTime = Math.max(0, Math.min(1, progress)) * duration;
    this.emit();
  }

  setTempoScale(scale: number): void {
    this.audio.playbackRate = Math.max(0.5, Math.min(1.5, scale));
    this.emit();
  }

  snapshot(): TransportSnapshot {
    const durationMs = Number.isFinite(this.audio.duration) ? this.audio.duration * 1000 : 0;
    const sourceTimeMs = this.audio.currentTime * 1000;
    const tempo = this.timeline.tempoAt(sourceTimeMs);
    return {
      state: this.state,
      presentationTimeMs: sourceTimeMs / this.audio.playbackRate,
      sourceTimeMs,
      durationMs,
      scoreQuarter: this.timeline.scoreQuarterAt(sourceTimeMs),
      tempoScale: this.audio.playbackRate,
      effectiveBpm: tempo.bpm * this.audio.playbackRate,
      progress: durationMs > 0 ? sourceTimeMs / durationMs : 0,
      activeNoteIds: this.timeline.activeNotesAt(sourceTimeMs).map((note) => note.id),
    };
  }

  dispose(): void {
    this.stopFrameLoop();
    this.audio.pause();
    this.audio.removeEventListener("play", this.onPlay);
    this.audio.removeEventListener("pause", this.onPause);
    this.audio.removeEventListener("ended", this.onEnded);
    this.audio.removeEventListener("loadedmetadata", this.emit);
    this.audio.removeEventListener("seeked", this.emit);
    this.listeners.clear();
  }

  private readonly onPlay = (): void => {
    this.state = "playing";
    this.startFrameLoop();
  };

  private readonly onPause = (): void => {
    if (!this.audio.ended) this.state = this.audio.currentTime > 0 ? "paused" : "idle";
    this.stopFrameLoop();
    this.emit();
  };

  private readonly onEnded = (): void => {
    this.state = "ended";
    this.stopFrameLoop();
    this.emit();
  };

  private startFrameLoop(): void {
    if (this.animationFrame !== null) return;
    const tick = () => {
      this.emit();
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private stopFrameLoop(): void {
    if (this.animationFrame === null) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private readonly emit = (): void => {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  };
}
