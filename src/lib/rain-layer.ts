import type { MidiNoteEvent } from "./midi";
import type { ScoreTarget } from "./score-renderer";

interface MappedNote {
  event: MidiNoteEvent;
  target: ScoreTarget;
  element: HTMLDivElement;
}

const FALL_DURATION_MS = 1200;

function easeInCubic(value: number): number {
  return value * value * value;
}

function findTarget(event: MidiNoteEvent, targets: ScoreTarget[], used: Set<string>): ScoreTarget | null {
  let best: ScoreTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    if (used.has(target.id)) continue;
    const pitchDistance = Math.abs(target.pitchMidi - event.midi);
    const timeDistance = Math.abs(target.scoreQuarter - event.scoreQuarter);
    const distance = pitchDistance * 8 + timeDistance;
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

export class RainLayer {
  private notes: MappedNote[] = [];

  constructor(private readonly container: HTMLElement) {}

  setEvents(events: MidiNoteEvent[], targets: ScoreTarget[]): number {
    this.container.replaceChildren();
    this.notes = [];
    const used = new Set<string>();

    for (const event of events) {
      const target = findTarget(event, targets, used);
      if (!target) continue;
      used.add(target.id);

      const element = document.createElement("div");
      element.className = `rain-note staff-${target.staffIndex % 2 === 0 ? "treble" : "bass"}`;
      element.title = `${event.name} · ${Math.round(event.attackMs)} ms`;
      this.container.append(element);
      this.notes.push({ event, target, element });
    }

    return this.notes.length;
  }

  update(timeMs: number): void {
    for (const note of this.notes) {
      const startMs = note.event.attackMs - FALL_DURATION_MS;
      if (timeMs < startMs) {
        note.element.hidden = true;
        continue;
      }

      note.element.hidden = false;
      const rawProgress = Math.max(0, Math.min(1, (timeMs - startMs) / FALL_DURATION_MS));
      const progress = easeInCubic(rawProgress);
      const spawnY = note.target.y - 180;
      const y = spawnY + (note.target.y - spawnY) * progress;
      const hitPulse = timeMs >= note.event.attackMs && timeMs < note.event.attackMs + 220;
      note.element.classList.toggle("is-hit", hitPulse);
      note.element.style.transform = `translate3d(${note.target.x}px, ${y}px, 0) rotate(-18deg)`;
    }
  }
}
