import { describe, expect, it, vi } from "vitest";
import { MidiTimeline, type MidiSummary } from "./midi";
import { MediaTransport, preRollSourceTime, TRANSPORT_PRE_ROLL_MS } from "./transport";

const EMPTY_MIDI: MidiSummary = {
  durationMs: 10_000,
  bpm: 120,
  ppq: 480,
  trackCount: 0,
  noteCount: 0,
  tempoMap: [{ ticks: 0, scoreQuarter: 0, timeMs: 0, bpm: 120 }],
  events: [],
};

class FakeAudio extends EventTarget {
  preload = "";
  preservesPitch = true;
  paused = true;
  ended = false;
  currentTime = 1;
  duration = 10;
  playbackRate = 1;
  muted = false;

  async play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  load(): void {}
}

describe("transport pre-roll", () => {
  it("advances from negative source time to the first audio frame", () => {
    expect(preRollSourceTime(0, 1)).toBe(-TRANSPORT_PRE_ROLL_MS);
    expect(preRollSourceTime(600, 1)).toBe(-600);
    expect(preRollSourceTime(1_200, 1)).toBe(0);
    expect(preRollSourceTime(1_500, 1)).toBe(0);
  });

  it("respects the selected playback rate", () => {
    expect(preRollSourceTime(1_200, 0.5)).toBe(-600);
    expect(preRollSourceTime(600, 2)).toBe(0);
  });
});

describe("transport frame loop", () => {
  it("does not schedule another frame when disposed by a frame listener", async () => {
    let queuedFrame: FrameRequestCallback | undefined;
    let requestCount = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queuedFrame = callback;
      requestCount += 1;
      return requestCount;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);

    try {
      const audio = new FakeAudio();
      const transport = new MediaTransport(audio as unknown as HTMLAudioElement, new MidiTimeline(EMPTY_MIDI));
      let emissionCount = 0;
      transport.subscribe(() => {
        emissionCount += 1;
        if (emissionCount === 2) transport.dispose();
      });

      await audio.play();
      expect(requestCount).toBe(1);
      queuedFrame?.(0);
      expect(requestCount).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
