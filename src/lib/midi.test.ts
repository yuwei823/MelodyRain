import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MidiTimeline, parseMidi } from "./midi";

const fixture = path.resolve(process.cwd(), "ode-to-joy", "ode-to-joy-easy-variation.mid");

describe("MIDI timeline", () => {
  it("parses note and tempo events from the bundled MIDI", () => {
    const source = readFileSync(fixture);
    const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
    const summary = parseMidi(buffer);

    expect(summary.ppq).toBeGreaterThan(0);
    expect(summary.trackCount).toBeGreaterThan(0);
    expect(summary.noteCount).toBeGreaterThan(0);
    expect(summary.durationMs).toBeGreaterThan(1_000);
    expect(summary.tempoMap[0]?.bpm).toBeGreaterThan(0);
    expect(summary.events).toEqual([...summary.events].sort((a, b) => a.attackMs - b.attackMs || a.midi - b.midi));
  });

  it("reports active notes and musical position from the same timeline", () => {
    const source = readFileSync(fixture);
    const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
    const summary = parseMidi(buffer);
    const timeline = new MidiTimeline(summary);
    const first = summary.events[0];
    expect(first).toBeDefined();
    if (!first) return;

    const active = timeline.activeNotesAt(first.attackMs + Math.min(10, first.durationMs / 2));
    expect(active.some((note) => note.id === first.id)).toBe(true);
    expect(timeline.scoreQuarterAt(first.attackMs)).toBeCloseTo(first.scoreQuarter, 2);
  });

  it("rejects data without an MThd signature", () => {
    expect(() => parseMidi(new TextEncoder().encode("not midi").buffer)).toThrow(/MIDI/);
  });
});
