// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { MidiTimeline } from "./midi";
import { growingSpanProgress, revealProgress, ScoreTimelineLayer } from "./score-timeline-layer";

describe("score timeline progress", () => {
  it("fades score annotations in over 300 milliseconds", () => {
    expect(revealProgress(999, 1_000)).toBe(0);
    expect(revealProgress(1_150, 1_000)).toBeCloseTo(0.5);
    expect(revealProgress(1_300, 1_000)).toBe(1);
  });

  it("grows a connecting span from its first to final note", () => {
    expect(growingSpanProgress(900, 1_000, 2_000)).toBe(0);
    expect(growingSpanProgress(1_500, 1_000, 2_000)).toBeCloseTo(0.5);
    expect(growingSpanProgress(2_000, 1_000, 2_000)).toBe(1);
  });

  it("grows hairpins with native SVG stroke dashes and restores their attributes", () => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "10");
    line.setAttribute("x2", "110");
    group.append(line);
    const timeline = {
      timeAtScoreQuarter: (quarter: number) => quarter * 1_000,
    } as MidiTimeline;
    const layer = new ScoreTimelineLayer(timeline);

    layer.setElements([], [{
      element: group,
      startQuarter: 1,
      endQuarter: 2,
      growthMode: "stroke",
    }]);

    expect(line.getAttribute("pathLength")).toBe("1");
    expect(line.style.strokeDasharray).toBe("1 1");
    expect(group.style.getPropertyValue("--score-stroke-hidden")).toBe("1");

    layer.update(1_500);
    expect(group.style.getPropertyValue("--score-stroke-hidden")).toBe("0.5");
    expect(group.style.clipPath).toBe("");

    layer.dispose();
    expect(line.hasAttribute("pathLength")).toBe(false);
    expect(line.style.strokeDasharray).toBe("");
    expect(line.style.strokeDashoffset).toBe("");
  });
});
