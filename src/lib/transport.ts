export type TransportState = "idle" | "playing" | "paused" | "ended";

export interface TransportSnapshot {
  state: TransportState;
  sourceTimeMs: number;
  durationMs: number;
  tempoScale: number;
  progress: number;
}

export type TransportListener = (snapshot: TransportSnapshot) => void;

export class MediaTransport {
  readonly audio: HTMLAudioElement;

  private listeners = new Set<TransportListener>();
  private animationFrame: number | null = null;
  private state: TransportState = "idle";

  constructor(audio: HTMLAudioElement) {
    this.audio = audio;
    this.audio.preload = "metadata";
    this.audio.preservesPitch = true;
    this.audio.addEventListener("play", () => {
      this.state = "playing";
      this.startFrameLoop();
    });
    this.audio.addEventListener("pause", () => {
      if (!this.audio.ended) this.state = this.audio.currentTime > 0 ? "paused" : "idle";
      this.stopFrameLoop();
      this.emit();
    });
    this.audio.addEventListener("ended", () => {
      this.state = "ended";
      this.stopFrameLoop();
      this.emit();
    });
    this.audio.addEventListener("loadedmetadata", () => this.emit());
    this.audio.addEventListener("seeked", () => this.emit());
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
    return {
      state: this.state,
      sourceTimeMs,
      durationMs,
      tempoScale: this.audio.playbackRate,
      progress: durationMs > 0 ? sourceTimeMs / durationMs : 0,
    };
  }

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

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
