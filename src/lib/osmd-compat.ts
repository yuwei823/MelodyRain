/** Central compatibility contract for the pinned OSMD/VexFlow SVG structure. */
export const OSMD_STAFF_LINE_SELECTOR = ".staffline";
export const OSMD_MEASURE_SELECTOR = ".vf-measure";

export interface OsmdSvgBackedGraphicalNote {
  getNoteheadSVGs(): HTMLElement[];
  getStemSVG(): HTMLElement;
  getVFNoteSVG(): HTMLElement;
  getLedgerLineSVGs(): HTMLElement[];
}

export function osmdOwnerSelector(scope: "measure" | "system"): string {
  return scope === "system" ? OSMD_STAFF_LINE_SELECTOR : OSMD_MEASURE_SELECTOR;
}
