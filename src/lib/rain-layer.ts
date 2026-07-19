import type { MidiNoteEvent, MidiTimeline } from "./midi";
import { OSMD_STAFF_LINE_SELECTOR } from "./osmd-compat";
import {
  FULL_RAINBOW_STOPS,
  PERFORMANCE_RAINBOW_PALETTE,
  normalizedGradientStops,
  stemOwnerTarget,
  type PerformancePaintAssignment,
  type PerformanceVisuals,
} from "./performance-effect-layer";
import type { ScoreTarget, TimedRainSymbol } from "./score-renderer";
import type { ConnectedNoteMode } from "./project-settings";

export interface RainChord {
  id: string;
  events: MidiNoteEvent[];
  targets: ScoreTarget[];
  attackMs: number;
  releaseMs: number;
}

interface RenderedRainSymbol {
  attackMs: number;
  elements: SVGGraphicsElement[];
  paints: PerformancePaintAssignment[];
  visibility: "hidden" | "visible";
  fallOffset: number | null;
  isHit: boolean;
  isLanded: boolean;
  falls: boolean;
}

interface BeamedChordGroup {
  chords: RainChord[];
  beamElements: SVGGraphicsElement[];
}

interface RenderedConnectedGroup {
  chords: RainChord[];
  beamElements: SVGGraphicsElement[];
  paints: PerformancePaintAssignment[];
  revealFractions: number[];
  visibility: "hidden" | "visible";
  fallOffset: number | null;
  clipProgress: number | null;
  isHit: boolean;
  isLanded: boolean;
}

const FALL_DURATION_MS = 1_200;
const FALL_DISTANCE_PX = 180;
const HIT_DURATION_MS = 200;
const MAX_TIME_DISTANCE_QUARTERS = 0.2;

function easeInCubic(value: number): number {
  return value * value * value;
}

function findTarget(event: MidiNoteEvent, targetsByPitch: Map<number, ScoreTarget[]>, used: Set<string>): ScoreTarget | null {
  let best: ScoreTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targetsByPitch.get(event.midi) ?? []) {
    if (used.has(target.id)) continue;
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
  const targetsByPitch = new Map<number, ScoreTarget[]>();
  for (const target of targets) {
    const bucket = targetsByPitch.get(target.pitchMidi);
    if (bucket) bucket.push(target);
    else targetsByPitch.set(target.pitchMidi, [target]);
  }

  for (const event of events) {
    const target = findTarget(event, targetsByPitch, used);
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

/**
 * MIDI tracks do not consistently preserve the MusicXML staff/voice structure.
 * Keep unmatched written notes animateable from their score position instead of
 * leaving their SVG hidden forever (a common failure mode for accompaniment
 * voices in the bass staff).
 */
export function fallbackRainChords(
  targets: ScoreTarget[],
  mappedTargetIds: Set<string>,
  timeAtScoreQuarter: (scoreQuarter: number) => number,
): RainChord[] {
  const groups = new Map<string, RainChord>();

  for (const target of targets) {
    // A continuation note has no separate MIDI note-on, but it is still a
    // written notehead. Schedule it from score time so it cannot remain
    // hidden behind the tie/reveal layer.
    if (!target.notation || mappedTargetIds.has(target.id)) continue;

    const notationId = target.notation.noteElement.id || target.id;
    const key = `${target.staffIndex}:${notationId}`;
    const attackMs = timeAtScoreQuarter(target.scoreQuarter);
    const existing = groups.get(key);
    if (existing) {
      existing.targets.push(target);
      continue;
    }

    groups.set(key, {
      id: `fallback-${groups.size}`,
      events: [],
      targets: [target],
      attackMs,
      releaseMs: attackMs,
    });
  }

  return [...groups.values()].sort((left, right) => left.attackMs - right.attackMs);
}

export function groupBeamedChords(chords: RainChord[]): BeamedChordGroup[] {
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

  const grouped = new Map<number, RainChord[]>();
  chords.forEach((chord, index) => {
    const root = find(index);
    const existing = grouped.get(root) ?? [];
    existing.push(chord);
    grouped.set(root, existing);
  });

  return [...grouped.values()].map((members) => {
    const sorted = [...members].sort((left, right) => chordX(left) - chordX(right) || left.attackMs - right.attackMs);
    return {
      chords: sorted,
      beamElements: [...new Set(sorted.flatMap((chord) =>
        chord.targets.flatMap((target) => target.notation?.beamElements ?? []),
      ))],
    };
  }).sort((left, right) => left.chords[0]!.attackMs - right.chords[0]!.attackMs);
}

function chordX(chord: RainChord): number {
  return Math.min(...chord.targets.map((target) => target.x));
}

function mergeChordGroup(chords: RainChord[]): RainChord {
  const first = chords[0]!;
  return {
    ...first,
    events: chords.flatMap((chord) => chord.events),
    targets: chords.flatMap((chord) => chord.targets),
    attackMs: Math.min(...chords.map((chord) => chord.attackMs)),
    releaseMs: Math.max(...chords.map((chord) => chord.releaseMs)),
  };
}

export function connectedBeamProgress(chords: RainChord[], timeMs: number): number {
  if (chords.length < 2) return timeMs >= chords[0]!.attackMs ? 1 : 0;
  const positions = chords.map(chordX);
  const left = positions[0]!;
  const width = Math.max(1, positions.at(-1)! - left);
  const fractions = positions.map((position, index) => index === 0 ? 0.05 : (position - left) / width);
  if (timeMs <= chords[0]!.attackMs) return fractions[0]!;
  for (let index = 1; index < chords.length; index += 1) {
    const previous = chords[index - 1]!;
    const next = chords[index]!;
    if (timeMs > next.attackMs) continue;
    const duration = next.attackMs - previous.attackMs;
    if (duration <= 0) return fractions[index]!;
    const progress = Math.max(0, Math.min(1, (timeMs - previous.attackMs) / duration));
    return fractions[index - 1]! + (fractions[index]! - fractions[index - 1]!) * progress;
  }
  return 1;
}

export class RainLayer {
  private symbols: RenderedRainSymbol[] = [];
  private connectedGroups: RenderedConnectedGroup[] = [];

  constructor(_container: HTMLElement, private readonly timeline: MidiTimeline) {}

  setEvents(
    events: MidiNoteEvent[],
    targets: ScoreTarget[],
    rests: TimedRainSymbol[] = [],
    connectedNoteMode: ConnectedNoteMode = "together",
  ): number {
    this.clearRenderedElements();
    this.connectedGroups = [];
    const midiChords = mapRainChords(events, targets);
    const mappedTargetIds = new Set(midiChords.flatMap((chord) => chord.targets.map((target) => target.id)));
    const groups = groupBeamedChords([
      ...midiChords,
      ...fallbackRainChords(targets, mappedTargetIds, (scoreQuarter) => this.timeline.timeAtScoreQuarter(scoreQuarter)),
    ]);
    const noteSymbols = groups.flatMap((group) => {
      if (connectedNoteMode !== "expand" || group.chords.length < 2 || group.beamElements.length === 0) {
        return [this.renderChord(mergeChordGroup(group.chords), true)];
      }
      this.connectedGroups.push(this.prepareConnectedGroup(group));
      return group.chords.map((chord, index) => this.renderChord(chord, false, index !== 0));
    });
    const restSymbols = rests.map((rest) => this.renderRest(rest));
    this.symbols = [...noteSymbols, ...restSymbols].sort((left, right) => left.attackMs - right.attackMs);
    return this.symbols.length;
  }

  update(timeMs: number): void {
    for (const symbol of this.symbols) {
      const { attackMs, elements } = symbol;
      const startMs = symbol.falls ? attackMs - FALL_DURATION_MS : attackMs;
      const isVisible = timeMs >= startMs;
      const rawProgress = symbol.falls ? Math.max(0, Math.min(1, (timeMs - startMs) / FALL_DURATION_MS)) : 1;
      const fallOffset = symbol.falls ? -FALL_DISTANCE_PX * (1 - easeInCubic(rawProgress)) : 0;
      const isHit = timeMs >= attackMs && timeMs < attackMs + HIT_DURATION_MS;
      const isLanded = timeMs >= attackMs;

      const visibility = isVisible ? "visible" : "hidden";
      if (visibility !== symbol.visibility) {
        elements.forEach((element) => { element.style.visibility = visibility; });
        symbol.visibility = visibility;
      }
      if (isVisible && fallOffset !== symbol.fallOffset) {
        elements.forEach((element) => { element.style.transform = `translateY(${fallOffset}px)`; });
        symbol.fallOffset = fallOffset;
      }
      if (isHit !== symbol.isHit) {
        elements.forEach((element) => element.classList.toggle("is-hit", isHit));
        symbol.isHit = isHit;
      }
      if (isLanded !== symbol.isLanded) {
        elements.forEach((element) => element.classList.toggle("is-landed", isLanded));
        symbol.isLanded = isLanded;
      }
    }
    this.connectedGroups.forEach((group) => this.updateConnectedGroup(group, timeMs));
  }

  dispose(): void {
    this.clearRenderedElements();
    this.symbols = [];
    this.connectedGroups = [];
  }

  performanceVisuals(): PerformanceVisuals {
    return {
      maskElements: [...new Set([
        ...this.symbols.flatMap((symbol) => symbol.elements),
        ...this.connectedGroups.flatMap((group) => group.beamElements),
      ])],
      paints: [
        ...this.symbols.flatMap((symbol) => symbol.paints),
        ...this.connectedGroups.flatMap((group) => group.paints),
      ],
    };
  }

  private prepareConnectedGroup(group: BeamedChordGroup): RenderedConnectedGroup {
    const merged = mergeChordGroup(group.chords);
    const beamSet = new Set(group.beamElements);
    const paints = this.chordPaints(merged).filter(({ element }) => beamSet.has(element));
    const staffClass = this.staffClassForElements(group.beamElements, merged.targets[0]?.staffIndex ?? 0);
    const positions = group.chords.map(chordX);
    const left = positions[0]!;
    const width = Math.max(1, positions.at(-1)! - left);
    const revealFractions = positions.map((position, index) => index === 0 ? 0.05 : (position - left) / width);
    group.beamElements.forEach((element) => {
      element.classList.add("rain-score-symbol", staffClass, "connected-note-beam");
      element.style.visibility = "hidden";
      element.style.clipPath = "inset(0 95% 0 0)";
    });
    return {
      chords: group.chords,
      beamElements: group.beamElements,
      paints,
      revealFractions,
      visibility: "hidden",
      fallOffset: null,
      clipProgress: null,
      isHit: false,
      isLanded: false,
    };
  }

  private updateConnectedGroup(group: RenderedConnectedGroup, timeMs: number): void {
    const firstAttackMs = group.chords[0]!.attackMs;
    const startMs = firstAttackMs - FALL_DURATION_MS;
    const visible = timeMs >= startMs;
    const visibility = visible ? "visible" : "hidden";
    if (visibility !== group.visibility) {
      group.beamElements.forEach((element) => { element.style.visibility = visibility; });
      group.visibility = visibility;
    }
    if (!visible) return;

    const fallProgress = Math.max(0, Math.min(1, (timeMs - startMs) / FALL_DURATION_MS));
    const fallOffset = timeMs < firstAttackMs ? -FALL_DISTANCE_PX * (1 - easeInCubic(fallProgress)) : 0;
    if (fallOffset !== group.fallOffset) {
      group.beamElements.forEach((element) => { element.style.transform = `translateY(${fallOffset}px)`; });
      group.fallOffset = fallOffset;
    }
    const clipProgress = connectedBeamProgress(group.chords, timeMs);
    if (clipProgress !== group.clipProgress) {
      const hiddenPercent = Math.max(0, (1 - clipProgress) * 100);
      group.beamElements.forEach((element) => { element.style.clipPath = `inset(0 ${hiddenPercent}% 0 0)`; });
      group.clipProgress = clipProgress;
    }
    const isHit = group.chords.some((chord) => timeMs >= chord.attackMs && timeMs < chord.attackMs + HIT_DURATION_MS);
    if (isHit !== group.isHit) {
      group.beamElements.forEach((element) => element.classList.toggle("is-hit", isHit));
      group.isHit = isHit;
    }
    const isLanded = timeMs >= firstAttackMs;
    if (isLanded !== group.isLanded) {
      group.beamElements.forEach((element) => element.classList.toggle("is-landed", isLanded));
      group.isLanded = isLanded;
    }
  }

  private renderChord(chord: RainChord, includeBeams = true, staticReveal = false): RenderedRainSymbol {
    const elements = new Set<SVGGraphicsElement>();
    chord.targets.forEach((target) => {
      if (!target.notation) return;
      elements.add(target.notation.noteElement);
      target.notation.attachedElements.forEach((element) => elements.add(element));
      if (includeBeams) target.notation.beamElements.forEach((element) => elements.add(element));
    });
    const paints = this.chordPaints(chord);
    const filteredPaints = includeBeams ? paints : paints.filter(({ element }) => !chord.targets.some(
      (target) => target.notation?.beamElements.includes(element),
    ));
    return this.prepareSymbol(chord.attackMs, [...elements], chord.targets[0]?.staffIndex ?? 0, filteredPaints, !staticReveal);
  }

  private renderRest(rest: TimedRainSymbol): RenderedRainSymbol {
    return this.prepareSymbol(
      this.timeline.timeAtScoreQuarter(rest.scoreQuarter),
      rest.elements,
      rest.staffIndex,
      rest.elements.map((element) => ({
        element,
        paint: { kind: "gradient", stops: FULL_RAINBOW_STOPS.map((stop) => ({ ...stop })) },
      })),
    );
  }

  private prepareSymbol(
    attackMs: number,
    elements: SVGGraphicsElement[],
    staffIndex: number,
    paints: PerformancePaintAssignment[],
    falls = true,
  ): RenderedRainSymbol {
    const staffClass = this.staffClassForElements(elements, staffIndex);
    elements.forEach((element) => {
      element.classList.add("rain-score-symbol", staffClass);
      element.style.visibility = "hidden";
    });

    return {
      attackMs,
      elements: [...new Set(elements)],
      paints,
      visibility: "hidden",
      fallOffset: null,
      isHit: false,
      isLanded: false,
      falls,
    };
  }

  private chordPaints(chord: RainChord): PerformancePaintAssignment[] {
    const paints: PerformancePaintAssignment[] = [];
    const notationGroups = new Map<SVGGraphicsElement, ScoreTarget[]>();
    chord.targets.forEach((target) => {
      const noteElement = target.notation?.noteElement;
      if (!noteElement) return;
      const group = notationGroups.get(noteElement) ?? [];
      group.push(target);
      notationGroups.set(noteElement, group);
    });

    notationGroups.forEach((targets, noteElement) => {
      const owner = stemOwnerTarget(targets) ?? targets[0]!;
      const ownerColor = PERFORMANCE_RAINBOW_PALETTE[owner.pitchStep];
      paints.push({ element: noteElement, paint: { kind: "solid", color: ownerColor } });
      targets.forEach((target) => {
        const color = PERFORMANCE_RAINBOW_PALETTE[target.pitchStep];
        if (target.noteheadElement) paints.push({ element: target.noteheadElement, paint: { kind: "solid", color } });
        target.notation?.attachedElements
          .filter((element) => element !== target.notation?.stemElement)
          .forEach((element) => paints.push({ element, paint: { kind: "solid", color } }));
      });
      const stems = new Set(targets.map((target) => target.notation?.stemElement).filter(Boolean));
      stems.forEach((element) => paints.push({
        element: element!,
        paint: { kind: "solid", color: ownerColor },
      }));
    });

    const beams = new Set(chord.targets.flatMap((target) => target.notation?.beamElements ?? []));
    beams.forEach((beam) => {
      const connected = chord.targets.filter((target) => target.notation?.beamElements.includes(beam));
      const connectedGroups = new Map<SVGGraphicsElement, ScoreTarget[]>();
      connected.forEach((target) => {
        const noteElement = target.notation?.noteElement;
        if (!noteElement) return;
        const group = connectedGroups.get(noteElement) ?? [];
        group.push(target);
        connectedGroups.set(noteElement, group);
      });
      const stops = normalizedGradientStops([...connectedGroups.values()].map((targets) => {
        const owner = stemOwnerTarget(targets) ?? targets[0]!;
        return { position: owner.x, color: PERFORMANCE_RAINBOW_PALETTE[owner.pitchStep] };
      }));
      paints.push({ element: beam, paint: { kind: "gradient", stops } });
    });
    return paints;
  }

  /**
   * The rendered SVG knows its staff reliably even when OSMD's graphical
   * staff index does not. Resolve this at the final animation boundary so a
   * piano's `…-2` bass staff can never inherit the treble class by mistake.
   */
  private staffClassForElements(elements: SVGGraphicsElement[], fallbackIndex: number): string {
    const staffId = elements
      .map((element) => element.closest(OSMD_STAFF_LINE_SELECTOR)?.id)
      .find(Boolean);
    const match = staffId?.match(/-(\d+)$/);
    const index = match ? Number(match[1]) - 1 : fallbackIndex;
    return index % 2 === 0 ? "staff-treble" : "staff-bass";
  }

  private clearRenderedElements(): void {
    [
      ...this.symbols.flatMap((rendered) => rendered.elements),
      ...this.connectedGroups.flatMap((group) => group.beamElements),
    ].forEach((element) => {
      element.classList.remove("rain-score-symbol", "staff-treble", "staff-bass", "is-hit", "is-landed", "connected-note-beam");
      element.style.removeProperty("transform");
      element.style.removeProperty("visibility");
      element.style.removeProperty("clip-path");
    });
  }
}
