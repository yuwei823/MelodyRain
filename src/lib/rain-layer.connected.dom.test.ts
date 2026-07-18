// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { MidiNoteEvent, MidiTimeline } from "./midi";
import { RainLayer, connectedBeamProgress, groupBeamedChords, type RainChord } from "./rain-layer";
import type { ScoreTarget } from "./score-renderer";

function svgElement(tag = "g"): SVGGraphicsElement {
  return document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGGraphicsElement;
}

function event(id: string, midi: number, quarter: number, attackMs: number): MidiNoteEvent {
  return { id, trackIndex: 0, trackName: "Piano", channel: 0, midi, name: id, velocity: 0.8,
    scoreQuarter: quarter, attackMs, releaseMs: attackMs + 400, durationMs: 400 };
}

function connectedTarget(id: string, midi: number, quarter: number, x: number, beam: SVGGraphicsElement): ScoreTarget {
  const note = svgElement();
  note.id = `note-${id}`;
  const stem = svgElement("path");
  const target: ScoreTarget = { id, pitchMidi: midi, pitchStep: "C", stemDirection: "up",
    scoreQuarter: quarter, staffIndex: 0, x, y: 50, width: 12, height: 8,
    noteheadElement: note, notation: { noteElement: note, attachedElements: [stem], stemElement: stem, beamElements: [beam] } };
  return target;
}

function timeline(): MidiTimeline {
  return { timeAtScoreQuarter: (quarter: number) => quarter * 500 } as MidiTimeline;
}

describe("connected-note rain modes", () => {
  it("keeps beamed chords and their independent attack times in one group", () => {
    const beam = svgElement("path");
    const firstTarget = connectedTarget("first", 60, 0, 100, beam);
    const secondTarget = connectedTarget("second", 62, 1, 160, beam);
    const chords: RainChord[] = [
      { id: "first", events: [], targets: [firstTarget], attackMs: 0, releaseMs: 400 },
      { id: "second", events: [], targets: [secondTarget], attackMs: 500, releaseMs: 900 },
    ];

    const groups = groupBeamedChords(chords);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.chords.map(({ attackMs }) => attackMs)).toEqual([0, 500]);
    expect(connectedBeamProgress(chords, 250)).toBeCloseTo(0.525);
  });

  it("drops the first chord, reveals later chords at note-on, and rebuilds after seeking backward", () => {
    const svg = svgElement("svg");
    const beam = svgElement("path");
    const first = connectedTarget("first", 60, 0, 100, beam);
    const second = connectedTarget("second", 62, 1, 160, beam);
    svg.append(first.notation!.noteElement, ...first.notation!.attachedElements,
      second.notation!.noteElement, ...second.notation!.attachedElements, beam);
    document.body.append(svg);
    const layer = new RainLayer(document.body, timeline());
    layer.setEvents([event("first", 60, 0, 0), event("second", 62, 1, 500)], [first, second], [], "expand");

    layer.update(-600);
    expect(first.notation!.noteElement.style.visibility).toBe("visible");
    expect(second.notation!.noteElement.style.visibility).toBe("hidden");
    expect(beam.style.transform).not.toBe("translateY(0px)");

    layer.update(250);
    expect(second.notation!.noteElement.style.visibility).toBe("hidden");
    expect(beam.style.clipPath).toContain("47.5%");

    layer.update(500);
    expect(second.notation!.noteElement.style.visibility).toBe("visible");
    expect(beam.style.clipPath).toBe("inset(0 0% 0 0)");

    layer.update(0);
    expect(second.notation!.noteElement.style.visibility).toBe("hidden");
    expect(beam.style.clipPath).toBe("inset(0 95% 0 0)");
  });

  it("keeps the legacy together mode unchanged", () => {
    const beam = svgElement("path");
    const first = connectedTarget("first", 60, 0, 100, beam);
    const second = connectedTarget("second", 62, 1, 160, beam);
    const layer = new RainLayer(document.body, timeline());
    layer.setEvents([event("first", 60, 0, 0), event("second", 62, 1, 500)], [first, second], [], "together");

    layer.update(-600);
    expect(first.notation!.noteElement.style.visibility).toBe("visible");
    expect(second.notation!.noteElement.style.visibility).toBe("visible");
    expect(beam.style.clipPath).toBe("");
  });
});
