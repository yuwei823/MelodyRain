import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { MidiTimeline, parseMidi } from "./midi";

function createMidiFixture(): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(140);
  const track = midi.addTrack();
  track.name = "Piano";
  track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
  track.addNote({ midi: 64, time: 1, duration: 0.75, velocity: 0.7 });
  const bytes = midi.toArray();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("MIDI timeline", () => {
  it("parses note and tempo events from the bundled MIDI", () => {
    const summary = parseMidi(createMidiFixture());

    expect(summary.ppq).toBeGreaterThan(0);
    expect(summary.trackCount).toBeGreaterThan(0);
    expect(summary.noteCount).toBeGreaterThan(0);
    expect(summary.durationMs).toBeGreaterThan(1_000);
    expect(summary.tempoMap[0]?.bpm).toBeGreaterThan(0);
    expect(summary.events).toEqual([...summary.events].sort((a, b) => a.attackMs - b.attackMs || a.midi - b.midi));
  });

  it("reports active notes and musical position from the same timeline", () => {
    const summary = parseMidi(createMidiFixture());
    const timeline = new MidiTimeline(summary);
    const first = summary.events[0];
    expect(first).toBeDefined();
    if (!first) return;

    const active = timeline.activeNotesAt(first.attackMs + Math.min(10, first.durationMs / 2));
    expect(active.some((note) => note.id === first.id)).toBe(true);
    expect(timeline.scoreQuarterAt(first.attackMs)).toBeCloseTo(first.scoreQuarter, 2);
    expect(timeline.timeAtScoreQuarter(first.scoreQuarter)).toBeCloseTo(first.attackMs, -1);
  });

  it("rejects data without an MThd signature", () => {
    expect(() => parseMidi(new TextEncoder().encode("not midi").buffer)).toThrow(/MIDI/);
  });
});
