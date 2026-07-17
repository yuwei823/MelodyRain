import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { applyMeasuresPerSystem } from "./score-layout";

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
}

export interface ScoreSymbolBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SvgBackedGraphicalNote {
  getNoteheadSVGs(): HTMLElement[];
  getStemSVG(): HTMLElement;
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

  async render(musicXml: string, measuresPerSystem = 4): Promise<ScoreTarget[]> {
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
    return this.collectTargets();
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

  private collectTargets(): ScoreTarget[] {
    const targets: ScoreTarget[] = [];
    const containers = this.osmd.GraphicSheet.VerticalGraphicalStaffEntryContainers;
    const hostBounds = this.container.getBoundingClientRect();

    for (const vertical of containers) {
      const scoreQuarter = vertical.AbsoluteTimestamp.RealValue * 4;
      vertical.StaffEntries.forEach((staffEntry, staffIndex) => {
        if (!staffEntry) return;
        for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
          for (const note of voiceEntry.notes) {
            if (!note.sourceNote.Pitch || note.sourceNote.isRest()) continue;
            const point = this.osmd.GraphicSheet.svgToDom(note.PositionAndShape.AbsolutePosition);
            const svgNote = note as unknown as SvgBackedGraphicalNote;
            const notehead = this.findNotehead(svgNote, point, hostBounds);
            const stem = this.findStem(svgNote, hostBounds);
            targets.push({
              id: `score-${targets.length}`,
              scoreQuarter,
              // OSMD numbers C4 as 48, while MIDI numbers C4 as 60.
              pitchMidi: note.sourceNote.Pitch.getHalfTone() + 12,
              staffIndex,
              x: notehead?.x ?? point.x,
              y: notehead?.y ?? point.y,
              width: notehead?.width ?? 12,
              height: notehead?.height ?? 8,
              stem: stem?.bounds,
            });
            notehead?.element.style.setProperty("visibility", "hidden");
            stem?.element.style.setProperty("visibility", "hidden");
          }
        }
      });
    }

    return targets;
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
