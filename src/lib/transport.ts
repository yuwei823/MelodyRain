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

export const TRANSPORT_PRE_ROLL_MS = 1_200;

export function preRollSourceTime(elapsedMs: number, playbackRate: number): number {
  return Math.min(0, -TRANSPORT_PRE_ROLL_MS + Math.max(0, elapsedMs) * playbackRate);
}

export class MediaTransport {
  readonly audio: HTMLAudioElement;

  private listeners = new Set<TransportListener>();
  private animationFrame: number | null = null;
  private frameLoopActive = false;
  private state: TransportState = "idle";
  private preRollTimeMs: number | null = null;
  private preRollStartedAtMs = 0;
  private preparingPreRoll = false;

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
    if (this.preRollTimeMs !== null) {
      this.cancelPreRoll();
      this.state = "idle";
      this.emit();
      return;
    }
    if (this.audio.paused) {
      if (this.audio.ended) this.audio.currentTime = 0;
      if (this.audio.currentTime === 0) await this.startPreRoll();
      else await this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  rewind(): void {
    this.cancelPreRoll();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.state = "idle";
    this.emit();
  }

  seek(progress: number): void {
    if (this.preRollTimeMs !== null) {
      this.cancelPreRoll();
      this.state = progress > 0 ? "paused" : "idle";
    }
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
    const sourceTimeMs = this.preRollTimeMs
      ?? (this.state === "idle" && this.audio.currentTime === 0 ? -TRANSPORT_PRE_ROLL_MS - 1 : this.audio.currentTime * 1000);
    const tempo = this.timeline.tempoAt(sourceTimeMs);
    return {
      state: this.state,
      presentationTimeMs: sourceTimeMs / this.audio.playbackRate,
      sourceTimeMs,
      durationMs,
      scoreQuarter: this.timeline.scoreQuarterAt(sourceTimeMs),
      tempoScale: this.audio.playbackRate,
      effectiveBpm: tempo.bpm * this.audio.playbackRate,
      progress: durationMs > 0 ? Math.max(0, sourceTimeMs) / durationMs : 0,
      activeNoteIds: this.timeline.activeNotesAt(sourceTimeMs).map((note) => note.id),
    };
  }

  dispose(): void {
    this.cancelPreRoll();
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
    if (this.preparingPreRoll || this.preRollTimeMs !== null) return;
    this.state = "playing";
    this.startFrameLoop();
  };

  private readonly onPause = (): void => {
    if (this.preparingPreRoll || this.preRollTimeMs !== null) return;
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
    if (this.frameLoopActive) return;
    this.frameLoopActive = true;
    const tick = () => {
      if (!this.frameLoopActive) return;
      this.animationFrame = null;
      this.advancePreRoll();
      this.emit();
      if (this.frameLoopActive) this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private stopFrameLoop(): void {
    this.frameLoopActive = false;
    if (this.animationFrame === null) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  private async startPreRoll(): Promise<void> {
    this.preparingPreRoll = true;
    const wasMuted = this.audio.muted;
    this.audio.muted = true;
    try {
      // Unlock the media element while this call still has user activation.
      await this.audio.play();
      this.audio.pause();
      this.audio.currentTime = 0;
    } finally {
      this.audio.muted = wasMuted;
      this.preparingPreRoll = false;
    }

    this.preRollTimeMs = -TRANSPORT_PRE_ROLL_MS;
    this.preRollStartedAtMs = performance.now();
    this.state = "playing";
    this.startFrameLoop();
    this.emit();
  }

  private advancePreRoll(): void {
    if (this.preRollTimeMs === null) return;
    this.preRollTimeMs = preRollSourceTime(
      performance.now() - this.preRollStartedAtMs,
      this.audio.playbackRate,
    );
    if (this.preRollTimeMs < 0) return;

    this.preRollTimeMs = null;
    this.audio.currentTime = 0;
    void this.audio.play().catch(() => {
      this.state = "idle";
      this.stopFrameLoop();
      this.emit();
    });
  }

  private cancelPreRoll(): void {
    this.preRollTimeMs = null;
    this.preRollStartedAtMs = 0;
    this.stopFrameLoop();
  }

  private readonly emit = (): void => {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  };
}
