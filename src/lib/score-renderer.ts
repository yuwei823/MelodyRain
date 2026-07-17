import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { applyMeasuresPerSystem } from "./score-layout";
import { removePedalMarkings } from "./score-sanitizer";

export interface ScoreTarget {
  id: string;
  scoreQuarter: number;
  pitchMidi: number;
  staffIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stem?: ScoreSymbolBounds;
  notation?: ScoreNotation;
  tieContinuation?: boolean;
}

export interface ScoreSymbolBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScoreNotation {
  noteElement: SVGGraphicsElement;
  attachedElements: SVGGraphicsElement[];
  beamElements: SVGGraphicsElement[];
}

export interface TimedScoreElement {
  element: SVGGraphicsElement;
  scoreQuarter: number;
}

export interface TimedRainSymbol {
  id: string;
  elements: SVGGraphicsElement[];
  ownerElement: SVGGraphicsElement;
  scoreQuarter: number;
  staffIndex: number;
  x: number;
  y: number;
}

export interface TimedScoreSpan {
  element: SVGGraphicsElement;
  startQuarter: number;
  endQuarter: number;
}

export interface TimedTieContinuation {
  elements: SVGGraphicsElement[];
  scoreQuarter: number;
  staffIndex: number;
}

export interface ScoreRenderResult {
  targets: ScoreTarget[];
  restSymbols: TimedRainSymbol[];
  revealElements: TimedScoreElement[];
  growingSpans: TimedScoreSpan[];
  tieContinuations: TimedTieContinuation[];
}

interface SvgBackedGraphicalNote {
  getNoteheadSVGs(): HTMLElement[];
  getStemSVG(): HTMLElement;
  getVFNoteSVG(): HTMLElement;
  getLedgerLineSVGs(): HTMLElement[];
}

interface ScoreTimingAnchor {
  scoreQuarter: number;
  x: number;
  ownerElement: SVGGraphicsElement;
}

export class ScoreRenderer {
  private readonly osmd: OpenSheetMusicDisplay;

  constructor(private readonly container: HTMLElement) {
    this.osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: "svg",
      drawTitle: false,
      drawingParameters: "compacttight",
      followCursor: false,
      newSystemFromXML: true,
    });
  }

  async render(musicXml: string, measuresPerSystem = 3, scoreScale = 2 / 3): Promise<ScoreRenderResult> {
    const laidOutXml = applyMeasuresPerSystem(removePedalMarkings(musicXml), measuresPerSystem);
    this.osmd.clear();
    await this.osmd.load(laidOutXml);
    const availableWidth = Math.max(320, this.container.clientWidth);
    const reservedWidthInOsmdUnits = measuresPerSystem === 1 ? 13 : 15;
    // OSMD/VexFlow adds clef, key-signature and connector space around the fixed measure body.
    // Keep a measured safety factor so the requested number does not wrap before the XML system break.
    const equalMeasureWidth = Math.max(
      7,
      (availableWidth / 10 / scoreScale / measuresPerSystem - reservedWidthInOsmdUnits / measuresPerSystem) * 0.72,
    );
    this.osmd.EngravingRules.FixedMeasureWidth = true;
    this.osmd.EngravingRules.FixedMeasureWidthFixedValue = equalMeasureWidth;
    this.osmd.EngravingRules.FixedMeasureWidthUseForPickupMeasures = true;
    this.osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = measuresPerSystem;
    this.osmd.Zoom = scoreScale;
    this.osmd.render();
    if (this.matchMeasureWidthsToFirstSystem()) {
      this.osmd.render();
    }
    const { targets, restSymbols } = this.collectTargets();
    const timingAnchors: ScoreTimingAnchor[] = [
      ...targets.flatMap((target) => target.notation ? [{
        scoreQuarter: target.scoreQuarter,
        x: target.x,
        ownerElement: target.notation.noteElement,
      }] : []),
      ...restSymbols.map((rest) => ({
        scoreQuarter: rest.scoreQuarter,
        x: rest.x,
        ownerElement: rest.ownerElement,
      })),
    ];
    const { revealElements, growingSpans } = this.collectTimedScoreElements(timingAnchors);
    const tieContinuations = this.collectTieContinuations(targets);
    return { targets, restSymbols, revealElements, growingSpans, tieContinuations };
  }

  private matchMeasureWidthsToFirstSystem(): boolean {
    const staffLines = [...this.container.querySelectorAll<SVGGElement>(".staffline")];
    const referenceStaffLine = staffLines[0];
    if (!referenceStaffLine) return false;

    const referenceMeasures = [...referenceStaffLine.querySelectorAll<SVGGElement>(":scope > .vf-measure")];
    const systemStaffLines = staffLines.filter((staffLine) => staffLine.id === referenceStaffLine.id);
    let changed = false;

    for (const staffLine of systemStaffLines.slice(1)) {
      const measures = [...staffLine.querySelectorAll<SVGGElement>(":scope > .vf-measure")];

      measures.forEach((measure, index) => {
        const source = measure.getBBox();
        const target = referenceMeasures[index]?.getBBox();
        if (!target || source.width <= 0) return;

        const sourceMeasure = this.osmd.Sheet.SourceMeasures.find(
          (candidate) => String(candidate.MeasureNumberXML) === measure.id,
        );
        if (!sourceMeasure) return;

        sourceMeasure.WidthFactor *= target.width / source.width;
        changed = true;
      });
    }

    return changed;
  }

  private collectTargets(): Pick<ScoreRenderResult, "targets" | "restSymbols"> {
    const targets: ScoreTarget[] = [];
    const restSymbols = new Map<string, TimedRainSymbol>();
    const containers = this.osmd.GraphicSheet.VerticalGraphicalStaffEntryContainers;
    const hostBounds = this.container.getBoundingClientRect();

    for (const vertical of containers) {
      const scoreQuarter = vertical.AbsoluteTimestamp.RealValue * 4;
      vertical.StaffEntries.forEach((staffEntry, staffIndex) => {
        if (!staffEntry) return;
        for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
          for (const note of voiceEntry.notes) {
            const point = this.osmd.GraphicSheet.svgToDom(note.PositionAndShape.AbsolutePosition);
            const svgNote = note as unknown as SvgBackedGraphicalNote;
            const notehead = this.findNotehead(svgNote, point, hostBounds);
            const stem = this.findStem(svgNote, hostBounds);
            const notation = this.findNotation(svgNote);
            const visualStaffIndex = this.staffIndexForNotation(notation?.noteElement, staffIndex);
            if (note.sourceNote.isRest()) {
              if (!notation) continue;
              const elements = [notation.noteElement, ...notation.attachedElements];
              const key = `${visualStaffIndex}:${scoreQuarter.toFixed(6)}:${notation.noteElement.id}`;
              if (!restSymbols.has(key)) {
                const bounds = notation.noteElement.getBoundingClientRect();
                elements.forEach((element) => element.style.setProperty("visibility", "hidden"));
                restSymbols.set(key, {
                  id: `rest-${restSymbols.size}`,
                  elements: [...new Set(elements)],
                  ownerElement: notation.noteElement,
                  scoreQuarter,
                  staffIndex: visualStaffIndex,
                  x: bounds.left - hostBounds.left + bounds.width / 2,
                  y: bounds.top - hostBounds.top + bounds.height / 2,
                });
              }
              continue;
            }
            if (!note.sourceNote.Pitch) continue;
            const tie = note.sourceNote.NoteTie;
            targets.push({
              id: `score-${targets.length}`,
              scoreQuarter,
              // OSMD numbers C4 as 48, while MIDI numbers C4 as 60.
              pitchMidi: note.sourceNote.Pitch.getHalfTone() + 12,
              staffIndex: visualStaffIndex,
              x: notehead?.x ?? point.x,
              y: notehead?.y ?? point.y,
              width: notehead?.width ?? 12,
              height: notehead?.height ?? 8,
              stem: stem?.bounds,
              notation,
              tieContinuation: Boolean(tie && tie.Notes.indexOf(note.sourceNote) > 0),
            });
            notation?.noteElement.style.setProperty("visibility", "hidden");
            notation?.attachedElements.forEach((element) => element.style.setProperty("visibility", "hidden"));
          }
        }
      });
    }

    this.attachBeams(targets, hostBounds);
    this.attachDetachedNoteModifiers(targets, hostBounds);
    this.collectUntrackedSvgNotes(targets, hostBounds);

    return { targets, restSymbols: [...restSymbols.values()] };
  }

  /**
   * Some MusicXML files render additional staff notes in VexFlow without
   * exposing them through OSMD's VerticalGraphicalStaffEntryContainers. This
   * is especially common for sparse lower piano staves. Discover those SVG
   * notes after rendering and give them the nearest same-measure score time.
   */
  private collectUntrackedSvgNotes(targets: ScoreTarget[], hostBounds: DOMRect): void {
    const tracked = new Set(targets.flatMap((target) => target.notation ? [target.notation.noteElement] : []));
    const untracked = [...this.container.querySelectorAll<SVGGraphicsElement>(".vf-stavenote")]
      .filter((element) => !tracked.has(element));

    untracked.forEach((noteElement) => {
      const bounds = noteElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const measureId = noteElement.closest(".vf-measure")?.id;
      const x = bounds.left - hostBounds.left + bounds.width / 2;
      const sameMeasure = targets.filter((target) =>
        target.notation?.noteElement.closest(".vf-measure")?.id === measureId,
      );
      const timingSource = this.nearestTargetAtX(sameMeasure.length > 0 ? sameMeasure : targets, x);
      if (!timingSource) return;

      const staffIndex = this.staffIndexForNotation(noteElement, timingSource.staffIndex);
      const notation: ScoreNotation = { noteElement, attachedElements: [], beamElements: [] };
      targets.push({
        id: `svg-fallback-${targets.length}`,
        scoreQuarter: timingSource.scoreQuarter,
        // No reliable OSMD pitch is available for this fallback; RainLayer will
        // schedule it from score time instead of attempting a MIDI match.
        pitchMidi: -1,
        staffIndex,
        x,
        y: bounds.top - hostBounds.top + bounds.height / 2,
        width: bounds.width,
        height: bounds.height,
        notation,
      });
      noteElement.style.setProperty("visibility", "hidden");
    });
  }

  private findNotation(note: SvgBackedGraphicalNote): ScoreNotation | undefined {
    if (typeof note.getVFNoteSVG !== "function") return undefined;

    try {
      const vfNoteElement = note.getVFNoteSVG() as unknown as SVGGraphicsElement | undefined;
      if (!vfNoteElement) return undefined;
      // VexFlow keeps dots, accidentals and articulations in the sibling
      // `.vf-modifiers` group, so animate the complete stave-note wrapper.
      const noteElement = (vfNoteElement.closest(".vf-stavenote") ?? vfNoteElement) as SVGGraphicsElement;
      const attachedElements = typeof note.getLedgerLineSVGs === "function"
        ? note.getLedgerLineSVGs().filter(Boolean) as unknown as SVGGraphicsElement[]
        : [];
      const siblingLedgerGroup = noteElement.parentElement?.querySelector<SVGGraphicsElement>(
        `[id="${noteElement.id}ledgers"]`,
      );
      if (siblingLedgerGroup && !attachedElements.includes(siblingLedgerGroup)) {
        attachedElements.push(siblingLedgerGroup);
      }
      // Beamed stems are rendered as siblings of `.vf-stavenote`, unlike regular
      // stems which are children of it. Bring those external stem groups along.
      if (typeof note.getStemSVG === "function") {
        const stemPath = note.getStemSVG() as unknown as SVGGraphicsElement | undefined;
        const stemGroup = stemPath?.parentElement?.matches("g.vf-stem")
          ? stemPath.parentElement as unknown as SVGGraphicsElement
          : stemPath;
        if (stemGroup && !noteElement.contains(stemGroup)) attachedElements.push(stemGroup);
      }
      return { noteElement, attachedElements, beamElements: [] };
    } catch {
      return undefined;
    }
  }

  /**
   * OSMD's VerticalGraphicalStaffEntryContainers can report index 0 for
   * multiple rendered staves. The SVG staffline id is the rendered source of
   * truth (`…-1`, `…-2`, etc.), so use it whenever available.
   */
  private staffIndexForNotation(noteElement: SVGGraphicsElement | undefined, fallback: number): number {
    const staffId = noteElement?.closest(".staffline")?.id;
    const match = staffId?.match(/-(\d+)$/);
    if (!match) return fallback;
    const index = Number(match[1]) - 1;
    return Number.isSafeInteger(index) && index >= 0 ? index : fallback;
  }

  private attachBeams(targets: ScoreTarget[], hostBounds: DOMRect): void {
    const beams = [...this.container.querySelectorAll<SVGGraphicsElement>(".vf-beam")];

    for (const beam of beams) {
      const beamBounds = beam.getBoundingClientRect();
      const beamLeft = beamBounds.left - hostBounds.left;
      const beamRight = beamBounds.right - hostBounds.left;
      const beamTop = beamBounds.top - hostBounds.top;
      const beamBottom = beamBounds.bottom - hostBounds.top;

      const connected = targets.filter((target) => {
        if (!target.stem || !target.notation) return false;
        const stemLeft = target.stem.x - target.stem.width / 2;
        const stemRight = target.stem.x + target.stem.width / 2;
        const stemTop = target.stem.y - target.stem.height / 2;
        const stemBottom = target.stem.y + target.stem.height / 2;
        const overlapsX = stemRight >= beamLeft - 3 && stemLeft <= beamRight + 3;
        const touchesY = beamBottom >= stemTop - 4 && beamTop <= stemBottom + 4;
        return overlapsX && touchesY;
      });

      if (connected.length < 2) continue;
      beam.style.setProperty("visibility", "hidden");
      connected.forEach((target) => target.notation?.beamElements.push(beam));
    }
  }

  private attachDetachedNoteModifiers(targets: ScoreTarget[], hostBounds: DOMRect): void {
    const selector = [
      ".vf-tremolo",
      ".vf-stroke",
      ".vf-ornament",
      '[class*="tremolo"]',
    ].join(",");
    const modifiers = [...this.container.querySelectorAll<SVGGraphicsElement>(selector)]
      .filter((element, index, all) => !all.some((candidate, candidateIndex) =>
        candidateIndex !== index && candidate.contains(element),
      ));

    modifiers.forEach((element) => {
      if (targets.some((target) => target.notation?.noteElement.contains(element))) return;
      const bounds = element.getBoundingClientRect();
      const centerX = bounds.left - hostBounds.left + bounds.width / 2;
      const ownerMeasure = element.closest(".vf-measure");
      const candidates = targets.filter((target) =>
        target.notation && (!ownerMeasure || target.notation.noteElement.closest(".vf-measure") === ownerMeasure),
      );
      const target = this.nearestTargetAtX(candidates, centerX);
      if (!target?.notation || Math.abs(target.x - centerX) > Math.max(18, target.width * 3)) return;
      if (!target.notation.attachedElements.includes(element)) target.notation.attachedElements.push(element);
      element.style.setProperty("visibility", "hidden");
    });
  }

  private collectTimedScoreElements(
    targets: ScoreTimingAnchor[],
  ): Pick<ScoreRenderResult, "revealElements" | "growingSpans"> {
    const growingSpanSelector = [
      ".vf-stavetie",
      ".vf-staveslur",
      '[class*="gliss"]',
      '[class*="slide"]',
      '[class*="wavy"]',
      '[class*="hammer"]',
      '[class*="pull-off"]',
      '[class*="bend"]',
    ].join(",");
    const revealSelector = [
      ".vf-stavetempo",
      ".vf-text",
      ".vf-line",
      '[class*="pedal"]',
      '[class*="octave"]',
      '[class*="volta"]',
      '[class*="rehearsal"]',
      '[class*="lyric"]',
      '[class*="chord-symbol"]',
      '[class*="coda"]',
      '[class*="segno"]',
      '[class*="breath"]',
      '[class*="caesura"]',
    ].join(",");
    const spanElements = [...this.container.querySelectorAll<SVGGraphicsElement>(growingSpanSelector)]
      .filter((element) => !element.closest(".vf-stavenote"))
      .filter((element, index, all) => !all.some((candidate, candidateIndex) =>
        candidateIndex !== index && candidate.contains(element),
      ));
    const spanSet = new Set(spanElements);
    const revealElements = [...this.container.querySelectorAll<SVGGraphicsElement>(revealSelector)]
      .filter((element) => !element.closest(".vf-stavenote") && !spanSet.has(element))
      .filter((element, index, all) => !all.some((candidate, candidateIndex) =>
        candidateIndex !== index && candidate.contains(element),
      ));

    const reveals = revealElements.flatMap((element) => {
      const candidates = this.targetsForElement(element, targets, "system");
      if (candidates.length === 0) return [];
      const elementLeft = element.getBoundingClientRect().left - this.container.getBoundingClientRect().left;
      const target = this.nearestTargetAtX(candidates, elementLeft);
      if (!target) return [];
      element.style.setProperty("visibility", "hidden");
      element.style.setProperty("opacity", "0");
      return [{ element, scoreQuarter: target.scoreQuarter }];
    });

    const spans = spanElements.flatMap((element) => {
      const candidates = this.targetsForElement(element, targets);
      if (candidates.length === 0) return [];
      const bounds = element.getBoundingClientRect();
      const hostLeft = this.container.getBoundingClientRect().left;
      const start = this.nearestTargetAtX(candidates, bounds.left - hostLeft);
      const end = this.nearestTargetAtX(candidates, bounds.right - hostLeft);
      if (!start) return [];
      element.style.setProperty("visibility", "hidden");
      element.style.setProperty("opacity", "0");
      const endQuarter = end && end.scoreQuarter > start.scoreQuarter
        ? end.scoreQuarter
        : start.scoreQuarter + Math.max(0.25, this.nextTargetQuarter(candidates, start.scoreQuarter));
      return [{ element, startQuarter: start.scoreQuarter, endQuarter }];
    });

    return { revealElements: reveals, growingSpans: spans };
  }

  private collectTieContinuations(targets: ScoreTarget[]): TimedTieContinuation[] {
    const groups = new Map<string, TimedTieContinuation>();

    targets.filter((target) => target.tieContinuation && target.notation).forEach((target) => {
      const notation = target.notation!;
      const key = `${target.staffIndex}:${target.scoreQuarter.toFixed(6)}:${notation.noteElement.id}`;
      const elements = [notation.noteElement, ...notation.attachedElements, ...notation.beamElements];
      const existing = groups.get(key);
      if (existing) {
        elements.forEach((element) => {
          if (!existing.elements.includes(element)) existing.elements.push(element);
        });
      } else {
        groups.set(key, {
          elements: [...new Set(elements)],
          scoreQuarter: target.scoreQuarter,
          staffIndex: target.staffIndex,
        });
      }
    });

    return [...groups.values()].sort((left, right) => left.scoreQuarter - right.scoreQuarter);
  }

  private targetsForElement(
    element: SVGGraphicsElement,
    targets: ScoreTimingAnchor[],
    scope: "measure" | "system" = "measure",
  ): ScoreTimingAnchor[] {
    const selector = scope === "system" ? ".staffline" : ".vf-measure";
    const owner = element.closest(selector);
    if (!owner) return targets;
    return targets.filter((target) => target.ownerElement.closest(selector) === owner);
  }

  private nearestTargetAtX<T extends { x: number }>(targets: T[], x: number): T | undefined {
    return targets.reduce<T | undefined>((nearest, target) => {
      if (!nearest) return target;
      return Math.abs(target.x - x) < Math.abs(nearest.x - x) ? target : nearest;
    }, undefined);
  }

  private nextTargetQuarter(targets: ScoreTimingAnchor[], startQuarter: number): number {
    const next = targets
      .map((target) => target.scoreQuarter)
      .filter((quarter) => quarter > startQuarter)
      .sort((left, right) => left - right)[0];
    return next === undefined ? 1 : next - startQuarter;
  }

  private findNotehead(
    note: SvgBackedGraphicalNote,
    fallback: { x: number; y: number },
    hostBounds: DOMRect,
  ): { element: HTMLElement; x: number; y: number; width: number; height: number } | undefined {
    if (typeof note.getNoteheadSVGs !== "function") return undefined;

    const candidates = note.getNoteheadSVGs()
      .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
      .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0);
    const selected = candidates.reduce<(typeof candidates)[number] | undefined>((best, candidate) => {
      const centerX = candidate.bounds.left - hostBounds.left + candidate.bounds.width / 2;
      const centerY = candidate.bounds.top - hostBounds.top + candidate.bounds.height / 2;
      const distance = Math.abs(centerX - fallback.x) + Math.abs(centerY - fallback.y);
      if (!best) return candidate;
      const bestX = best.bounds.left - hostBounds.left + best.bounds.width / 2;
      const bestY = best.bounds.top - hostBounds.top + best.bounds.height / 2;
      return distance < Math.abs(bestX - fallback.x) + Math.abs(bestY - fallback.y) ? candidate : best;
    }, undefined);
    if (!selected) return undefined;

    return {
      element: selected.element,
      x: selected.bounds.left - hostBounds.left + selected.bounds.width / 2,
      y: selected.bounds.top - hostBounds.top + selected.bounds.height / 2,
      width: selected.bounds.width,
      height: selected.bounds.height,
    };
  }

  private findStem(
    note: SvgBackedGraphicalNote,
    hostBounds: DOMRect,
  ): { element: HTMLElement; bounds: ScoreSymbolBounds } | undefined {
    if (typeof note.getStemSVG !== "function") return undefined;

    try {
      const element = note.getStemSVG();
      const bounds = element?.getBoundingClientRect();
      if (!element || !bounds || bounds.height <= 0) return undefined;
      return {
        element,
        bounds: {
          x: bounds.left - hostBounds.left + bounds.width / 2,
          y: bounds.top - hostBounds.top + bounds.height / 2,
          width: bounds.width,
          height: bounds.height,
        },
      };
    } catch {
      return undefined;
    }
  }
}
