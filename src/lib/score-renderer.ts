import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { applyMeasuresPerSystem } from "./score-layout";

export interface ScoreTarget {
  id: string;
  scoreQuarter: number;
  pitchMidi: number;
  staffIndex: number;
  x: number;
  y: number;
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

    for (const vertical of containers) {
      const scoreQuarter = vertical.AbsoluteTimestamp.RealValue * 4;
      vertical.StaffEntries.forEach((staffEntry, staffIndex) => {
        if (!staffEntry) return;
        for (const voiceEntry of staffEntry.graphicalVoiceEntries) {
          for (const note of voiceEntry.notes) {
            if (!note.sourceNote.Pitch || note.sourceNote.isRest()) continue;
            const point = this.osmd.GraphicSheet.svgToDom(note.PositionAndShape.AbsolutePosition);
            targets.push({
              id: `score-${targets.length}`,
              scoreQuarter,
              pitchMidi: note.sourceNote.Pitch.getHalfTone(),
              staffIndex,
              x: point.x,
              y: point.y,
            });
          }
        }
      });
    }

    return targets;
  }
}
