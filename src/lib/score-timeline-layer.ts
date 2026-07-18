import type { MidiTimeline } from "./midi";
import {
  FULL_RAINBOW_STOPS,
  PERFORMANCE_RAINBOW_PALETTE,
  type PerformanceVisuals,
} from "./performance-effect-layer";
import type { TimedScoreElement, TimedScoreSpan, TimedTieContinuation } from "./score-renderer";

export const SCORE_REVEAL_DURATION_MS = 300;

export function revealProgress(timeMs: number, triggerMs: number): number {
  return Math.max(0, Math.min(1, (timeMs - triggerMs) / SCORE_REVEAL_DURATION_MS));
}

export function growingSpanProgress(timeMs: number, startMs: number, endMs: number): number {
  if (timeMs < startMs) return 0;
  if (endMs <= startMs) return 1;
  return Math.max(0, Math.min(1, (timeMs - startMs) / (endMs - startMs)));
}

export function tieContinuationVisible(timeMs: number, triggerMs: number): boolean {
  return timeMs >= triggerMs;
}

interface RenderedReveal {
  element: SVGGraphicsElement;
  triggerMs: number;
}

interface RenderedSpan {
  element: SVGGraphicsElement;
  startMs: number;
  endMs: number;
  startColor?: string;
  endColor?: string;
}

interface RenderedTieContinuation {
  elements: SVGGraphicsElement[];
  triggerMs: number;
  staffIndex: number;
}

export class ScoreTimelineLayer {
  private reveals: RenderedReveal[] = [];
  private spans: RenderedSpan[] = [];
  private tieContinuations: RenderedTieContinuation[] = [];

  constructor(private readonly timeline: MidiTimeline) {}

  setElements(
    reveals: TimedScoreElement[],
    spans: TimedScoreSpan[],
    tieContinuations: TimedTieContinuation[] = [],
  ): void {
    this.dispose();
    this.reveals = reveals.map(({ element, scoreQuarter }) => ({
      element,
      triggerMs: this.timeline.timeAtScoreQuarter(scoreQuarter),
    }));
    this.spans = spans.map(({ element, startQuarter, endQuarter, startPitchStep, endPitchStep }) => ({
      element,
      startMs: this.timeline.timeAtScoreQuarter(startQuarter),
      endMs: this.timeline.timeAtScoreQuarter(endQuarter),
      startColor: startPitchStep ? PERFORMANCE_RAINBOW_PALETTE[startPitchStep] : undefined,
      endColor: endPitchStep ? PERFORMANCE_RAINBOW_PALETTE[endPitchStep] : undefined,
    }));
    this.tieContinuations = tieContinuations.map(({ elements, scoreQuarter, staffIndex }) => ({
      elements,
      triggerMs: this.timeline.timeAtScoreQuarter(scoreQuarter),
      staffIndex,
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
    this.tieContinuations.forEach(({ elements, staffIndex }) => {
      const staffClass = staffIndex % 2 === 0 ? "staff-treble" : "staff-bass";
      elements.forEach((element) => {
        element.classList.add("tie-continuation-score-symbol", staffClass);
        element.style.visibility = "hidden";
        element.style.opacity = "0";
      });
    });
  }

  update(timeMs: number): void {
    this.reveals.forEach(({ element, triggerMs }) => {
      const progress = revealProgress(timeMs, triggerMs);
      element.style.visibility = progress > 0 ? "visible" : "hidden";
      element.style.opacity = String(progress);
      element.classList.toggle("is-revealed", progress >= 1);
    });

    this.spans.forEach(({ element, startMs, endMs }) => {
      const progress = growingSpanProgress(timeMs, startMs, endMs);
      const visibleProgress = progress > 0 ? progress : 0.005;
      element.style.visibility = timeMs >= startMs ? "visible" : "hidden";
      element.style.opacity = timeMs >= startMs ? "1" : "0";
      element.style.clipPath = `inset(0 ${(1 - visibleProgress) * 100}% 0 0)`;
      element.classList.toggle("is-complete", progress >= 1);
    });

    this.tieContinuations.forEach(({ elements, triggerMs }) => {
      const isVisible = tieContinuationVisible(timeMs, triggerMs);
      elements.forEach((element) => {
        element.style.visibility = isVisible ? "visible" : "hidden";
        element.style.opacity = isVisible ? "1" : "0";
        element.classList.toggle("is-sustained", isVisible);
      });
    });
  }

  performanceVisuals(): PerformanceVisuals {
    return {
      maskElements: [
        ...this.reveals.map(({ element }) => element),
        ...this.spans.map(({ element }) => element),
        ...this.tieContinuations.flatMap(({ elements }) => elements),
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
        ...this.tieContinuations.flatMap(({ elements }) => elements.map((element) => ({
          element,
          paint: { kind: "gradient" as const, stops: FULL_RAINBOW_STOPS.map((stop) => ({ ...stop })) },
        }))),
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
    this.tieContinuations.flatMap(({ elements }) => elements).forEach((element) => {
      element.classList.remove(
        "tie-continuation-score-symbol",
        "staff-treble",
        "staff-bass",
        "is-sustained",
      );
      element.style.removeProperty("visibility");
      element.style.removeProperty("opacity");
    });
    this.reveals = [];
    this.spans = [];
    this.tieContinuations = [];
  }
}
