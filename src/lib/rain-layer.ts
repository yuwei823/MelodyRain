import type { MidiNoteEvent } from "./midi";
import type { ScoreTarget } from "./score-renderer";

export interface RainChord {
  id: string;
  events: MidiNoteEvent[];
  targets: ScoreTarget[];
  attackMs: number;
  releaseMs: number;
}

interface RenderedChord {
  chord: RainChord;
  elements: SVGGraphicsElement[];
}

const FALL_DURATION_MS = 1_200;
const FALL_DISTANCE_PX = 180;
const MAX_TIME_DISTANCE_QUARTERS = 0.2;

function easeInCubic(value: number): number {
  return value * value * value;
}

function findTarget(event: MidiNoteEvent, targets: ScoreTarget[], used: Set<string>): ScoreTarget | null {
  let best: ScoreTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (used.has(target.id) || target.pitchMidi !== event.midi) continue;
    const distance = Math.abs(target.scoreQuarter - event.scoreQuarter);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return bestDistance <= MAX_TIME_DISTANCE_QUARTERS ? best : null;
}

export function mapRainChords(events: MidiNoteEvent[], targets: ScoreTarget[]): RainChord[] {
  const used = new Set<string>();
  const groups = new Map<string, RainChord>();

  for (const event of events) {
    const target = findTarget(event, targets, used);
    if (!target) continue;
    used.add(target.id);

    const notationId = target.notation?.noteElement.id;
    const positionId = notationId || `${target.scoreQuarter.toFixed(6)}:${Math.round(target.x * 2)}`;
    const key = `${target.staffIndex}:${positionId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
      existing.targets.push(target);
      existing.attackMs = Math.min(existing.attackMs, event.attackMs);
      existing.releaseMs = Math.max(existing.releaseMs, event.releaseMs);
    } else {
      groups.set(key, {
        id: `rain-${groups.size}`,
        events: [event],
        targets: [target],
        attackMs: event.attackMs,
        releaseMs: event.releaseMs,
      });
    }
  }

  return [...groups.values()].sort((left, right) => left.attackMs - right.attackMs);
}

function mergeBeamedChords(chords: RainChord[]): RainChord[] {
  const parents = chords.map((_, index) => index);
  const firstChordForBeam = new Map<SVGGraphicsElement, number>();

  const find = (index: number): number => {
    while (parents[index]! !== index) {
      parents[index] = parents[parents[index]!]!;
      index = parents[index]!;
    }
    return index;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  chords.forEach((chord, chordIndex) => {
    const beams = new Set(chord.targets.flatMap((target) => target.notation?.beamElements ?? []));
    beams.forEach((beam) => {
      const firstIndex = firstChordForBeam.get(beam);
      if (firstIndex === undefined) firstChordForBeam.set(beam, chordIndex);
      else union(firstIndex, chordIndex);
    });
  });

  const merged = new Map<number, RainChord>();
  chords.forEach((chord, index) => {
    const root = find(index);
    const existing = merged.get(root);
    if (!existing) {
      merged.set(root, { ...chord, events: [...chord.events], targets: [...chord.targets] });
      return;
    }
    existing.events.push(...chord.events);
    existing.targets.push(...chord.targets);
    existing.attackMs = Math.min(existing.attackMs, chord.attackMs);
    existing.releaseMs = Math.max(existing.releaseMs, chord.releaseMs);
  });

  return [...merged.values()].sort((left, right) => left.attackMs - right.attackMs);
}

export class RainLayer {
  private chords: RenderedChord[] = [];

  constructor(_container: HTMLElement) {}

  setEvents(events: MidiNoteEvent[], targets: ScoreTarget[]): number {
    this.clearRenderedElements();
    this.chords = mergeBeamedChords(mapRainChords(events, targets)).map((chord) => this.renderChord(chord));
    return this.chords.length;
  }

  update(timeMs: number): void {
    for (const { chord, elements } of this.chords) {
      const startMs = chord.attackMs - FALL_DURATION_MS;
      const isVisible = timeMs >= startMs;
      const rawProgress = Math.max(0, Math.min(1, (timeMs - startMs) / FALL_DURATION_MS));
      const fallOffset = -FALL_DISTANCE_PX * (1 - easeInCubic(rawProgress));
      const isHit = timeMs >= chord.attackMs && timeMs < chord.attackMs + 260;
      const isLanded = timeMs >= chord.attackMs;

      elements.forEach((element) => {
        element.style.visibility = isVisible ? "visible" : "hidden";
        element.style.transform = `translateY(${fallOffset}px)`;
        element.classList.toggle("is-hit", isHit);
        element.classList.toggle("is-landed", isLanded);
      });
    }
  }

  dispose(): void {
    this.clearRenderedElements();
    this.chords = [];
  }

  private renderChord(chord: RainChord): RenderedChord {
    const elements = new Set<SVGGraphicsElement>();
    chord.targets.forEach((target) => {
      if (!target.notation) return;
      elements.add(target.notation.noteElement);
      target.notation.attachedElements.forEach((element) => elements.add(element));
      target.notation.beamElements.forEach((element) => elements.add(element));
    });

    const staffClass = (chord.targets[0]?.staffIndex ?? 0) % 2 === 0 ? "staff-treble" : "staff-bass";
    elements.forEach((element) => {
      element.classList.add("rain-score-symbol", staffClass);
      element.style.visibility = "hidden";
    });

    return { chord, elements: [...elements] };
  }

  private clearRenderedElements(): void {
    this.chords.flatMap((rendered) => rendered.elements).forEach((element) => {
      element.classList.remove("rain-score-symbol", "staff-treble", "staff-bass", "is-hit", "is-landed");
      element.style.removeProperty("transform");
      element.style.removeProperty("visibility");
    });
  }
}
