import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { applyMeasuresPerSystem } from "./score-layout";
import {
  pitchStepFromFundamentalNote,
  type PitchStep,
  type StemDirection,
} from "./performance-effect-layer";
import { collectVisibleScoreMaskElements } from "./score-mask-layer";

export interface ScoreTarget {
  id: string;
  scoreQuarter: number;
  pitchMidi: number;
  pitchStep: PitchStep;
  stemDirection: StemDirection;
  staffIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stem?: ScoreSymbolBounds;
  noteheadElement?: SVGGraphicsElement;
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
  stemElement?: SVGGraphicsElement;
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
  startPitchStep?: PitchStep;
  endPitchStep?: PitchStep;
}

export interface ScoreRenderResult {
  targets: ScoreTarget[];
  restSymbols: TimedRainSymbol[];
  revealElements: TimedScoreElement[];
  growingSpans: TimedScoreSpan[];
  maskElements: SVGGraphicsElement[];
}

interface SvgBackedGraphicalNote {
  getNoteheadSVGs(): HTMLElement[];
  getStemSVG(): HTMLElement;
  getVFNoteSVG(): HTMLElement;
  getLedgerLineSVGs(): HTMLElement[];
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

  async render(musicXml: string, measuresPerSystem = 4, _requestedScoreScale?: number): Promise<ScoreRenderResult> {
    const laidOutXml = applyMeasuresPerSystem(musicXml, measuresPerSystem);
    this.osmd.clear();
    await this.osmd.load(laidOutXml);
    const availableWidth = Math.max(320, this.container.clientWidth);
    const reservedWidthInOsmdUnits = measuresPerSystem === 1 ? 13 : 15;
    // OSMD/VexFlow adds clef, key-signature and connector space around the fixed measure body.
    // Keep a measured safety factor so the requested number does not wrap before the XML system break.
    const equalMeasureWidth = Math.max(
      7,
      (availableWidth / 10 / measuresPerSystem - reservedWidthInOsmdUnits / measuresPerSystem) * 0.72,
    );
    this.osmd.EngravingRules.FixedMeasureWidth = true;
    this.osmd.EngravingRules.FixedMeasureWidthFixedValue = equalMeasureWidth;
    this.osmd.EngravingRules.FixedMeasureWidthUseForPickupMeasures = true;
    this.osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = measuresPerSystem;
    this.osmd.Zoom = 1;
    this.osmd.render();
    if (this.matchMeasureWidthsToFirstSystem()) {
      this.osmd.render();
    }
    const { targets, restSymbols } = this.collectTargets();
    const { revealElements, growingSpans } = this.collectTimedScoreElements(targets);
    const maskElements = collectVisibleScoreMaskElements(this.container);
    return { targets, restSymbols, revealElements, growingSpans, maskElements };
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
            if (note.sourceNote.isRest()) {
              // Only hide a rest once its complete SVG representation has
              // been registered for RainLayer. OSMD omits some sparse-staff
              // rests from this graph; those must remain visible on the score.
              if (!notation) continue;
              const elements = [...new Set([notation.noteElement, ...notation.attachedElements])];
              const bounds = notation.noteElement.getBoundingClientRect();
              if (elements.length === 0 || bounds.width <= 0 || bounds.height <= 0) continue;
              const key = `${staffIndex}:${scoreQuarter.toFixed(6)}:${notation.noteElement.id}`;
              if (!restSymbols.has(key)) {
                restSymbols.set(key, {
                  id: `rest-${restSymbols.size}`,
                  elements,
                  ownerElement: notation.noteElement,
                  scoreQuarter,
                  staffIndex,
                  x: bounds.left - hostBounds.left + bounds.width / 2,
                  y: bounds.top - hostBounds.top + bounds.height / 2,
                });
                elements.forEach((element) => element.style.setProperty("visibility", "hidden"));
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
              pitchStep: pitchStepFromFundamentalNote(note.sourceNote.Pitch.FundamentalNote),
              stemDirection: note.sourceNote.ParentVoiceEntry.StemDirection === 1
                ? "down"
                : note.sourceNote.ParentVoiceEntry.StemDirection === 0 ? "up" : "none",
              staffIndex,
              x: notehead?.x ?? point.x,
              y: notehead?.y ?? point.y,
              width: notehead?.width ?? 12,
              height: notehead?.height ?? 8,
              stem: stem?.bounds,
              noteheadElement: notehead?.element as SVGGraphicsElement | undefined,
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

    return { targets, restSymbols: [...restSymbols.values()] };
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
      let stemElement: SVGGraphicsElement | undefined;
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
        stemElement = stemGroup;
        if (stemGroup && !noteElement.contains(stemGroup)) attachedElements.push(stemGroup);
      }
      const outermostAttachedElements = [...new Set(attachedElements)].filter((element, _index, elements) => (
        !elements.some((candidate) => candidate !== element && candidate.contains(element))
      ));
      return { noteElement, attachedElements: outermostAttachedElements, stemElement, beamElements: [] };
    } catch {
      return undefined;
    }
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

      // A short secondary beam can belong to one sixteenth-note stem only.
      // It is still part of that note's visual body and must not remain on
      // the stationary score after the notehead has begun falling.
      if (connected.length === 0) continue;
      beam.style.setProperty("visibility", "hidden");
      connected.forEach((target) => target.notation?.beamElements.push(beam));
    }
  }

  private collectTimedScoreElements(
    targets: ScoreTarget[],
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
      return [{
        element,
        startQuarter: start.scoreQuarter,
        endQuarter,
        startPitchStep: start.pitchStep,
        endPitchStep: end?.pitchStep ?? start.pitchStep,
      }];
    });

    return { revealElements: reveals, growingSpans: spans };
  }

  private targetsForElement(
    element: SVGGraphicsElement,
    targets: ScoreTarget[],
    scope: "measure" | "system" = "measure",
  ): ScoreTarget[] {
    const selector = scope === "system" ? ".staffline" : ".vf-measure";
    const owner = element.closest(selector);
    if (!owner) return targets;
    return targets.filter((target) => target.notation?.noteElement.closest(selector) === owner);
  }

  private nearestTargetAtX(targets: ScoreTarget[], x: number): ScoreTarget | undefined {
    return targets.reduce<ScoreTarget | undefined>((nearest, target) => {
      if (!nearest) return target;
      return Math.abs(target.x - x) < Math.abs(nearest.x - x) ? target : nearest;
    }, undefined);
  }

  private nextTargetQuarter(targets: ScoreTarget[], startQuarter: number): number {
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
