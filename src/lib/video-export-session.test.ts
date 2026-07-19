// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { MidiTimeline, type MidiSummary } from "./midi";
import { VideoExportCancelledError, runVideoExportSession } from "./video-export-session";

const MIDI: MidiSummary = {
  durationMs: 100,
  bpm: 120,
  ppq: 480,
  trackCount: 0,
  noteCount: 0,
  tempoMap: [{ ticks: 0, scoreQuarter: 0, timeMs: 0, bpm: 120 }],
  events: [],
};

describe("video export session", () => {
  it("renders deterministic frames in order and reports progress", async () => {
    const canvas = document.createElement("canvas");
    const consumed: number[] = [];
    const progress: number[] = [];
    const stageTimes: number[] = [];

    const count = await runVideoExportSession({
        timeline: new MidiTimeline(MIDI),
        durationMs: 100,
        fps: 10,
        renderer: { prepare: vi.fn(), render: vi.fn(async () => canvas) },
        updateStage: (snapshot) => { stageTimes.push(snapshot.sourceTimeMs); },
        consumeFrame: (_canvas, frame) => { consumed.push(frame.index); },
        onProgress: (value) => { progress.push(value); },
    });

    expect(count).toBe(14);
    expect(consumed).toEqual([...Array(14).keys()]);
    expect(stageTimes[0]).toBe(-1_200);
    expect(progress.at(-1)).toBe(1);
  });

  it("stops before rendering when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runVideoExportSession({
      timeline: new MidiTimeline(MIDI),
      durationMs: 100,
      renderer: { prepare: vi.fn(), render: vi.fn() },
      updateStage: vi.fn(),
      consumeFrame: vi.fn(),
      signal: controller.signal,
    })).rejects.toBeInstanceOf(VideoExportCancelledError);
  });
});
