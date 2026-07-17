import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

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
    });
  }

  async render(musicXml: string): Promise<ScoreTarget[]> {
    await this.osmd.load(musicXml);
    this.osmd.Zoom = 1;
    this.osmd.render();
    return this.collectTargets();
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
