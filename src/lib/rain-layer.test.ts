import { describe, expect, it } from "vitest";
import type { MidiNoteEvent } from "./midi";
import { mapRainChords } from "./rain-layer";
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
  return { id, pitchMidi, scoreQuarter, staffIndex, x, y, width: 12, height: 8 };
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
});
