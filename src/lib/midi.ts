import { Midi } from "@tonejs/midi";

export interface MidiNoteEvent {
  id: string;
  trackIndex: number;
  midi: number;
  name: string;
  velocity: number;
  scoreQuarter: number;
  attackMs: number;
  releaseMs: number;
  durationMs: number;
}

export interface MidiSummary {
  durationMs: number;
  bpm: number;
  ppq: number;
  trackCount: number;
  noteCount: number;
  events: MidiNoteEvent[];
}

export function parseMidi(buffer: ArrayBuffer): MidiSummary {
  const midi = new Midi(buffer);
  const events = midi.tracks
    .flatMap((track, trackIndex) =>
      track.notes.map((note, noteIndex) => ({
        id: `track-${trackIndex}-note-${noteIndex}`,
        trackIndex,
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

  return {
    durationMs: Math.round(midi.duration * 1000),
    bpm: midi.header.tempos[0]?.bpm ?? 120,
    ppq: midi.header.ppq,
    trackCount: midi.tracks.length,
    noteCount: events.length,
    events,
  };
}
