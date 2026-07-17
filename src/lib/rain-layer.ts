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
  element: HTMLDivElement;
  anchorX: number;
  anchorY: number;
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

    const key = `${target.staffIndex}:${target.scoreQuarter.toFixed(6)}:${Math.round(target.x * 2)}`;
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

export class RainLayer {
  private readonly layer: HTMLDivElement;
  private chords: RenderedChord[] = [];

  constructor(private readonly container: HTMLElement) {
    this.layer = document.createElement("div");
    this.layer.className = "rain-layer";
    this.layer.setAttribute("aria-hidden", "true");
    this.container.append(this.layer);
  }

  setEvents(events: MidiNoteEvent[], targets: ScoreTarget[]): number {
    this.layer.replaceChildren();
    this.chords = mapRainChords(events, targets).map((chord) => this.renderChord(chord));
    return this.chords.length;
  }

  update(timeMs: number): void {
    for (const rendered of this.chords) {
      const { chord, element, anchorX, anchorY } = rendered;
      const startMs = chord.attackMs - FALL_DURATION_MS;
      if (timeMs < startMs) {
        element.hidden = true;
        continue;
      }

      element.hidden = false;
      const rawProgress = Math.max(0, Math.min(1, (timeMs - startMs) / FALL_DURATION_MS));
      const progress = easeInCubic(rawProgress);
      const fallOffset = -FALL_DISTANCE_PX * (1 - progress);
      const rotation = -14 * (1 - progress);
      const scale = 0.9 + progress * 0.1;
      const hitPulse = timeMs >= chord.attackMs && timeMs < chord.attackMs + 260;

      element.classList.toggle("is-hit", hitPulse);
      element.classList.toggle("is-landed", timeMs >= chord.attackMs);
      element.style.transform =
        `translate3d(${anchorX}px, ${anchorY + fallOffset}px, 0) rotate(${rotation}deg) scale(${scale})`;
    }
  }

  dispose(): void {
    this.chords = [];
    this.layer.remove();
  }

  private renderChord(chord: RainChord): RenderedChord {
    const minX = Math.min(...chord.targets.map((target) => target.x - target.width / 2));
    const maxX = Math.max(...chord.targets.map((target) => target.x + target.width / 2));
    const minY = Math.min(...chord.targets.map((target) => target.y - target.height / 2));
    const maxY = Math.max(...chord.targets.map((target) => target.y + target.height / 2));
    const anchorX = (minX + maxX) / 2;
    const anchorY = (minY + maxY) / 2;
    const element = document.createElement("div");
    element.className = `rain-chord staff-${(chord.targets[0]?.staffIndex ?? 0) % 2 === 0 ? "treble" : "bass"}`;
    element.title = chord.events.map((event) => event.name).join(" + ");
    element.hidden = true;

    const stems = new Map<string, NonNullable<ScoreTarget["stem"]>>();
    chord.targets.forEach((target) => {
      if (!target.stem) return;
      const key = [target.stem.x, target.stem.y, target.stem.width, target.stem.height]
        .map((value) => Math.round(value * 2))
        .join(":");
      stems.set(key, target.stem);
    });
    stems.forEach((stem) => {
      const elementStem = document.createElement("span");
      elementStem.className = "rain-stem";
      elementStem.style.left = `${stem.x - anchorX - Math.max(1.25, stem.width) / 2}px`;
      elementStem.style.top = `${stem.y - anchorY - stem.height / 2}px`;
      elementStem.style.width = `${Math.max(1.25, stem.width)}px`;
      elementStem.style.height = `${stem.height}px`;
      element.append(elementStem);
    });

    chord.targets.forEach((target) => {
      const head = document.createElement("span");
      head.className = "rain-notehead";
      head.style.left = `${target.x - anchorX - target.width / 2}px`;
      head.style.top = `${target.y - anchorY - target.height / 2}px`;
      head.style.width = `${Math.max(8, target.width)}px`;
      head.style.height = `${Math.max(6, target.height)}px`;
      element.append(head);
    });

    this.layer.append(element);
    return { chord, element, anchorX, anchorY };
  }
}
