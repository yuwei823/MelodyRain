import type { MidiTimeline } from "./midi";
import {
  FULL_RAINBOW_STOPS,
  PERFORMANCE_RAINBOW_PALETTE,
  type PerformanceVisuals,
} from "./performance-effect-layer";
import type { TimedScoreElement, TimedScoreSpan } from "./score-renderer";

export const SCORE_REVEAL_DURATION_MS = 300;

export function revealProgress(timeMs: number, triggerMs: number): number {
  return Math.max(0, Math.min(1, (timeMs - triggerMs) / SCORE_REVEAL_DURATION_MS));
}

export function growingSpanProgress(timeMs: number, startMs: number, endMs: number): number {
  if (timeMs < startMs) return 0;
  if (endMs <= startMs) return 1;
  return Math.max(0, Math.min(1, (timeMs - startMs) / (endMs - startMs)));
}

interface RenderedReveal {
  element: SVGGraphicsElement;
  triggerMs: number;
  progress: number;
}

interface RenderedSpan {
  element: SVGGraphicsElement;
  startMs: number;
  endMs: number;
  startColor?: string;
  endColor?: string;
  progress: number;
}

export class ScoreTimelineLayer {
  private reveals: RenderedReveal[] = [];
  private spans: RenderedSpan[] = [];

  constructor(private readonly timeline: MidiTimeline) {}

  setElements(
    reveals: TimedScoreElement[],
    spans: TimedScoreSpan[],
  ): void {
    this.dispose();
    this.reveals = reveals.map(({ element, scoreQuarter }) => ({
      element,
      triggerMs: this.timeline.timeAtScoreQuarter(scoreQuarter),
      progress: Number.NaN,
    }));
    this.spans = spans.map(({ element, startQuarter, endQuarter, startPitchStep, endPitchStep }) => ({
      element,
      startMs: this.timeline.timeAtScoreQuarter(startQuarter),
      endMs: this.timeline.timeAtScoreQuarter(endQuarter),
      startColor: startPitchStep ? PERFORMANCE_RAINBOW_PALETTE[startPitchStep] : undefined,
      endColor: endPitchStep ? PERFORMANCE_RAINBOW_PALETTE[endPitchStep] : undefined,
      progress: Number.NaN,
    }));
    this.reveals.forEach(({ element }) => {
      element.classList.add("score-reveal-symbol");
      element.style.visibility = "hidden";
      element.style.opacity = "0";
    });
    this.spans.forEach(({ element }) => {
      element.classList.add("score-growing-span");
      element.style.visibility = "hidden";
      element.style.opacity = "0";
      element.style.clipPath = "inset(0 100% 0 0)";
    });
  }

  update(timeMs: number): void {
    this.reveals.forEach((rendered) => {
      const { element, triggerMs } = rendered;
      const progress = revealProgress(timeMs, triggerMs);
      if (progress === rendered.progress) return;
      element.style.visibility = progress > 0 ? "visible" : "hidden";
      element.style.opacity = String(progress);
      element.classList.toggle("is-revealed", progress >= 1);
      rendered.progress = progress;
    });

    this.spans.forEach((rendered) => {
      const { element, startMs, endMs } = rendered;
      const progress = growingSpanProgress(timeMs, startMs, endMs);
      if (progress === rendered.progress) return;
      const visibleProgress = progress > 0 ? progress : 0.005;
      element.style.visibility = timeMs >= startMs ? "visible" : "hidden";
      element.style.opacity = timeMs >= startMs ? "1" : "0";
      element.style.clipPath = `inset(0 ${(1 - visibleProgress) * 100}% 0 0)`;
      element.classList.toggle("is-complete", progress >= 1);
      rendered.progress = progress;
    });

  }

  performanceVisuals(): PerformanceVisuals {
    return {
      maskElements: [
        ...this.reveals.map(({ element }) => element),
        ...this.spans.map(({ element }) => element),
      ],
      paints: [
        ...this.reveals.map(({ element }) => ({
          element,
          paint: { kind: "gradient" as const, stops: FULL_RAINBOW_STOPS.map((stop) => ({ ...stop })) },
        })),
        ...this.spans.map(({ element, startColor, endColor }) => ({
          element,
          paint: {
            kind: "gradient" as const,
            stops: startColor && endColor
              ? [{ offset: 0, color: startColor }, { offset: 1, color: endColor }]
              : FULL_RAINBOW_STOPS.map((stop) => ({ ...stop })),
          },
        })),
      ],
    };
  }

  dispose(): void {
    [...this.reveals, ...this.spans].forEach(({ element }) => {
      element.classList.remove("score-reveal-symbol", "score-growing-span", "is-revealed", "is-complete");
      element.style.removeProperty("visibility");
      element.style.removeProperty("opacity");
      element.style.removeProperty("clip-path");
    });
    this.reveals = [];
    this.spans = [];
  }
}
