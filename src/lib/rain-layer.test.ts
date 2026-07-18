import { describe, expect, it } from "vitest";
import type { MidiNoteEvent } from "./midi";
import { fallbackRainChords, mapRainChords } from "./rain-layer";
import type { ScoreTarget } from "./score-renderer";

function event(id: string, midi: number, scoreQuarter: number, attackMs: number): MidiNoteEvent {
  return {
    id,
    trackIndex: 0,
    trackName: "Piano",
    channel: 0,
    midi,
    name: `MIDI ${midi}`,
    velocity: 0.8,
    scoreQuarter,
    attackMs,
    releaseMs: attackMs + 500,
    durationMs: 500,
  };
}

function target(id: string, pitchMidi: number, scoreQuarter: number, staffIndex: number, x: number, y: number): ScoreTarget {
  return {
    id,
    pitchMidi,
    pitchStep: "C",
    stemDirection: "up",
    scoreQuarter,
    staffIndex,
    x,
    y,
    width: 12,
    height: 8,
  };
}

describe("rain chord mapping", () => {
  it("combines simultaneous pitches on one staff into a single multi-head chord", () => {
    const chords = mapRainChords(
      [event("c", 60, 0, 0), event("e", 64, 0, 0), event("g", 67, 0, 0)],
      [target("tc", 60, 0, 0, 100, 50), target("te", 64, 0, 0, 100, 42), target("tg", 67, 0, 0, 100, 34)],
    );

    expect(chords).toHaveLength(1);
    expect(chords[0]?.targets).toHaveLength(3);
  });

  it("keeps repeated notes as distinct falling drops", () => {
    const chords = mapRainChords(
      [event("first", 60, 0, 0), event("second", 60, 1, 500)],
      [target("t1", 60, 0, 0, 100, 50), target("t2", 60, 1, 0, 140, 50)],
    );

    expect(chords).toHaveLength(2);
    expect(chords.map((chord) => chord.attackMs)).toEqual([0, 500]);
  });

  it("does not attach a MIDI event to a distant or wrong-pitch score note", () => {
    const chords = mapRainChords(
      [event("wrong", 61, 0, 0), event("late", 60, 2, 1_000)],
      [target("target", 60, 0, 0, 100, 50)],
    );

    expect(chords).toHaveLength(0);
  });

  it("schedules an unmatched written bass note from the score tempo map", () => {
    const bassTarget = target("bass", 43, 4, 1, 100, 120);
    bassTarget.notation = {
      noteElement: { id: "bass-note" } as unknown as SVGGraphicsElement,
      attachedElements: [],
      beamElements: [],
    };

    const chords = fallbackRainChords([bassTarget], new Set(), (quarter) => quarter * 500);

    expect(chords).toHaveLength(1);
    expect(chords[0]?.attackMs).toBe(2_000);
    expect(chords[0]?.targets).toEqual([bassTarget]);
  });

  it("also schedules a tied continuation when MIDI has no new note-on", () => {
    const tiedBassTarget = target("tied-bass", 43, 6, 1, 140, 120);
    tiedBassTarget.tieContinuation = true;
    tiedBassTarget.notation = {
      noteElement: { id: "tied-bass-note" } as unknown as SVGGraphicsElement,
      attachedElements: [],
      beamElements: [],
    };

    const chords = fallbackRainChords([tiedBassTarget], new Set(), (quarter) => quarter * 500);

    expect(chords).toHaveLength(1);
    expect(chords[0]?.attackMs).toBe(3_000);
  });
});
