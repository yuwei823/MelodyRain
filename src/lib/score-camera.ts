export function uniformVerticalCameraOffset(
  sourceTimeMs: number,
  motionStartMs: number,
  motionEndMs: number,
  viewportHeight: number,
  scoreHeight: number,
): number {
  if (motionEndMs <= motionStartMs || viewportHeight <= 0 || scoreHeight <= viewportHeight) return 0;
  const progress = Math.max(0, Math.min(1, (sourceTimeMs - motionStartMs) / (motionEndMs - motionStartMs)));
  return progress * (scoreHeight - viewportHeight);
}

export class ScoreCamera {
  private sourceTimeMs = 0;
  private motionStartMs = 0;
  private motionEndMs = 0;
  private viewportHeight = 0;
  private scoreHeight = 0;
  private lastOffset: number | null = null;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly contentClip: HTMLElement,
    private readonly scoreHost: HTMLElement,
  ) {
    this.observer = new ResizeObserver(() => {
      this.measure();
      this.update(this.sourceTimeMs, this.motionStartMs, this.motionEndMs);
    });
    this.observer.observe(viewport);
    this.observer.observe(contentClip);
    this.observer.observe(scoreHost);
    this.measure();
  }

  update(sourceTimeMs: number, motionStartMs: number, motionEndMs: number): void {
    this.sourceTimeMs = sourceTimeMs;
    this.motionStartMs = motionStartMs;
    this.motionEndMs = motionEndMs;
    const offset = uniformVerticalCameraOffset(
      sourceTimeMs,
      motionStartMs,
      motionEndMs,
      this.viewportHeight,
      this.scoreHeight,
    );
    if (offset === this.lastOffset) return;
    this.viewport.style.setProperty("--score-camera-offset-y", `${-offset}px`);
    this.scoreHost.style.transform = "translateY(var(--score-camera-offset-y))";
    this.lastOffset = offset;
  }

  private measure(): void {
    this.viewportHeight = this.contentClip.clientHeight;
    this.scoreHeight = this.contentClip.scrollHeight;
  }

  dispose(): void {
    this.observer.disconnect();
    this.scoreHost.style.removeProperty("transform");
    this.viewport.style.removeProperty("--score-camera-offset-y");
    this.lastOffset = null;
  }
}
