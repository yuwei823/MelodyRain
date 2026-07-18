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
}

interface RenderedSpan {
  element: SVGGraphicsElement;
  startMs: number;
  endMs: number;
  growthMode: "clip" | "stroke";
  strokeSegments: StrokeSegment[];
  startColor?: string;
  endColor?: string;
}

interface StrokeSegment {
  element: SVGGeometryElement;
  pathLength: string | null;
  strokeDasharray: string;
  strokeDashoffset: string;
}

const STROKE_GEOMETRY_SELECTOR = "path,line,polyline,polygon";

function geometryRunsRightToLeft(element: SVGGeometryElement): boolean {
  if (element.tagName.toLowerCase() === "line") {
    return Number(element.getAttribute("x1")) > Number(element.getAttribute("x2"));
  }
  try {
    const length = element.getTotalLength();
    return length > 0 && element.getPointAtLength(0).x > element.getPointAtLength(length).x;
  } catch {
    return false;
  }
}

function prepareStrokeSegments(element: SVGGraphicsElement): StrokeSegment[] {
  const candidates = element.matches(STROKE_GEOMETRY_SELECTOR)
    ? [element as SVGGeometryElement]
    : [...element.querySelectorAll<SVGGeometryElement>(STROKE_GEOMETRY_SELECTOR)];
  return candidates.map((segment) => {
    const original = {
      element: segment,
      pathLength: segment.getAttribute("pathLength"),
      strokeDasharray: segment.style.strokeDasharray,
      strokeDashoffset: segment.style.strokeDashoffset,
    };
    segment.setAttribute("pathLength", "1");
    segment.style.strokeDasharray = "1 1";
    segment.style.strokeDashoffset = geometryRunsRightToLeft(segment)
      ? "calc(0 - var(--score-stroke-hidden, 1))"
      : "var(--score-stroke-hidden, 1)";
    return original;
  });
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
    }));
    this.spans = spans.map(({
      element, startQuarter, endQuarter, growthMode = "clip", startPitchStep, endPitchStep,
    }) => ({
      element,
      startMs: this.timeline.timeAtScoreQuarter(startQuarter),
      endMs: this.timeline.timeAtScoreQuarter(endQuarter),
      growthMode,
      strokeSegments: growthMode === "stroke" ? prepareStrokeSegments(element) : [],
      startColor: startPitchStep ? PERFORMANCE_RAINBOW_PALETTE[startPitchStep] : undefined,
      endColor: endPitchStep ? PERFORMANCE_RAINBOW_PALETTE[endPitchStep] : undefined,
    }));
    this.reveals.forEach(({ element }) => {
      element.classList.add("score-reveal-symbol");
      element.style.visibility = "hidden";
      element.style.opacity = "0";
    });
    this.spans.forEach(({ element, growthMode }) => {
      element.classList.add("score-growing-span");
      if (growthMode === "stroke") element.classList.add("score-stroke-growing-span");
      element.style.visibility = "hidden";
      element.style.opacity = "0";
      if (growthMode === "clip") element.style.clipPath = "inset(0 100% 0 0)";
      else element.style.setProperty("--score-stroke-hidden", "1");
    });
  }

  update(timeMs: number): void {
    this.reveals.forEach(({ element, triggerMs }) => {
      const progress = revealProgress(timeMs, triggerMs);
      element.style.visibility = progress > 0 ? "visible" : "hidden";
      element.style.opacity = String(progress);
      element.classList.toggle("is-revealed", progress >= 1);
    });

    this.spans.forEach(({ element, startMs, endMs, growthMode }) => {
      const progress = growingSpanProgress(timeMs, startMs, endMs);
      const visibleProgress = progress > 0 ? progress : 0.005;
      element.style.visibility = timeMs >= startMs ? "visible" : "hidden";
      element.style.opacity = timeMs >= startMs ? "1" : "0";
      if (growthMode === "clip") {
        element.style.clipPath = `inset(0 ${(1 - visibleProgress) * 100}% 0 0)`;
      } else {
        element.style.setProperty("--score-stroke-hidden", String(1 - visibleProgress));
      }
      element.classList.toggle("is-complete", progress >= 1);
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
      element.classList.remove("score-reveal-symbol", "score-growing-span", "score-stroke-growing-span", "is-revealed", "is-complete");
      element.style.removeProperty("visibility");
      element.style.removeProperty("opacity");
      element.style.removeProperty("clip-path");
      element.style.removeProperty("--score-stroke-hidden");
    });
    this.spans.flatMap(({ strokeSegments }) => strokeSegments).forEach((segment) => {
      if (segment.pathLength === null) segment.element.removeAttribute("pathLength");
      else segment.element.setAttribute("pathLength", segment.pathLength);
      segment.element.style.strokeDasharray = segment.strokeDasharray;
      segment.element.style.strokeDashoffset = segment.strokeDashoffset;
    });
    this.reveals = [];
    this.spans = [];
  }
}
