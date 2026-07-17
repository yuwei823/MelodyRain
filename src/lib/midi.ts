import { Midi } from "@tonejs/midi";

export interface MidiNoteEvent {
  id: string;
  trackIndex: number;
  trackName: string;
  channel: number;
  midi: number;
  name: string;
  velocity: number;
  scoreQuarter: number;
  attackMs: number;
  releaseMs: number;
  durationMs: number;
}

export interface TempoEvent {
  ticks: number;
  scoreQuarter: number;
  timeMs: number;
  bpm: number;
}

export interface MidiSummary {
  durationMs: number;
  bpm: number;
  ppq: number;
  trackCount: number;
  noteCount: number;
  tempoMap: TempoEvent[];
  events: MidiNoteEvent[];
}

export function parseMidi(buffer: ArrayBuffer): MidiSummary {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (String.fromCharCode(...bytes) !== "MThd") throw new Error("文件不是有效的 Standard MIDI File");

  const midi = new Midi(buffer);
  const events = midi.tracks
    .flatMap((track, trackIndex) =>
      track.notes.map((note, noteIndex) => ({
        id: `track-${trackIndex}-note-${noteIndex}`,
        trackIndex,
        trackName: track.name || `Track ${trackIndex + 1}`,
        channel: track.channel,
        midi: note.midi,
        name: note.name,
        velocity: note.velocity,
        scoreQuarter: note.ticks / midi.header.ppq,
        attackMs: Math.round(note.time * 1000),
        releaseMs: Math.round((note.time + note.duration) * 1000),
        durationMs: Math.round(note.duration * 1000),
      })),
    )
    .sort((left, right) => left.attackMs - right.attackMs || left.midi - right.midi);

  const tempoMap = midi.header.tempos.map((tempo) => ({
    ticks: tempo.ticks,
    scoreQuarter: tempo.ticks / midi.header.ppq,
    timeMs: Math.round((tempo.time ?? midi.header.ticksToSeconds(tempo.ticks)) * 1000),
    bpm: tempo.bpm,
  }));
  if (tempoMap.length === 0) tempoMap.push({ ticks: 0, scoreQuarter: 0, timeMs: 0, bpm: 120 });

  return {
    durationMs: Math.round(midi.duration * 1000),
    bpm: tempoMap[0]?.bpm ?? 120,
    ppq: midi.header.ppq,
    trackCount: midi.tracks.length,
    noteCount: events.length,
    tempoMap,
    events,
  };
}

export class MidiTimeline {
  constructor(readonly summary: MidiSummary) {}

  tempoAt(timeMs: number): TempoEvent {
    let selected = this.summary.tempoMap[0];
    for (const tempo of this.summary.tempoMap) {
      if (tempo.timeMs > timeMs) break;
      selected = tempo;
    }
    return selected ?? { ticks: 0, scoreQuarter: 0, timeMs: 0, bpm: 120 };
  }

  scoreQuarterAt(timeMs: number): number {
    const tempo = this.tempoAt(timeMs);
    return tempo.scoreQuarter + ((timeMs - tempo.timeMs) * tempo.bpm) / 60_000;
  }

  activeNotesAt(timeMs: number): MidiNoteEvent[] {
    return this.summary.events.filter((event) => event.attackMs <= timeMs && event.releaseMs > timeMs);
  }
}
