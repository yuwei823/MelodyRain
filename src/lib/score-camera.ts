export interface VerticalCameraAnchor {
  scoreQuarter: number;
  x: number;
  y: number;
}

interface VerticalCameraSystem {
  startQuarter: number;
  centerY: number;
}

interface WorkingSystem {
  startQuarter: number;
  top: number;
  bottom: number;
  lastX: number;
}

export const SCORE_CAMERA_FOCUS_RATIO = 1.7;

interface VerticalCameraOptions {
  focusRatio?: number;
  contentTop?: number;
}

/** Groups note/rest positions into score systems, rather than following every note. */
function systemsFromAnchors(anchors: VerticalCameraAnchor[]): VerticalCameraSystem[] {
  const columns = new Map<number, VerticalCameraAnchor[]>();
  anchors.forEach((anchor) => {
    const key = Math.round(anchor.scoreQuarter * 1_000_000);
    const entries = columns.get(key) ?? [];
    entries.push(anchor);
    columns.set(key, entries);
  });

  const orderedColumns = [...columns.values()]
    .map((entries) => ({
      scoreQuarter: entries[0]!.scoreQuarter,
      x: entries.reduce((sum, entry) => sum + entry.x, 0) / entries.length,
      top: Math.min(...entries.map((entry) => entry.y)),
      bottom: Math.max(...entries.map((entry) => entry.y)),
    }))
    .sort((left, right) => left.scoreQuarter - right.scoreQuarter);
  const systems: WorkingSystem[] = [];

  orderedColumns.forEach((column) => {
    const current = systems[systems.length - 1];
    // A new system starts when the musical position returns to the left edge.
    if (!current || column.x < current.lastX - 12) {
      systems.push({ startQuarter: column.scoreQuarter, top: column.top, bottom: column.bottom, lastX: column.x });
      return;
    }
    current.top = Math.min(current.top, column.top);
    current.bottom = Math.max(current.bottom, column.bottom);
    current.lastX = column.x;
  });

  return systems.map(({ startQuarter, top, bottom }) => ({ startQuarter, centerY: (top + bottom) / 2 }));
}

function cameraOffsetForSystems(
  systems: VerticalCameraSystem[],
  scoreQuarter: number,
  viewportHeight: number,
  scoreHeight: number,
  focusRatio: number,
  contentTop: number,
): number {
  if (systems.length === 0 || viewportHeight <= 0 || scoreHeight <= viewportHeight) return 0;
  let low = 0;
  let high = systems.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (systems[middle]!.startQuarter <= scoreQuarter) low = middle;
    else high = middle - 1;
  }
  const desiredOffset = contentTop + systems[low]!.centerY - viewportHeight / focusRatio;
  return Math.max(0, Math.min(desiredOffset, Math.max(0, scoreHeight - viewportHeight)));
}

export function verticalCameraOffset(
  anchors: VerticalCameraAnchor[],
  scoreQuarter: number,
  viewportHeight: number,
  scoreHeight: number,
  options: VerticalCameraOptions = {},
): number {
  if (anchors.length === 0 || viewportHeight <= 0 || scoreHeight <= viewportHeight) return 0;
  const focusRatio = options.focusRatio && options.focusRatio > 0
    ? options.focusRatio
    : SCORE_CAMERA_FOCUS_RATIO;
  const contentTop = Math.max(0, options.contentTop ?? 0);
  return cameraOffsetForSystems(
    systemsFromAnchors(anchors), scoreQuarter, viewportHeight, scoreHeight, focusRatio, contentTop,
  );
}

export class ScoreCamera {
  private systems: VerticalCameraSystem[] = [];
  private scoreQuarter = 0;
  private viewportHeight = 0;
  private scoreHeight = 0;
  private contentTop = 0;
  private lastOffset: number | null = null;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly contentClip: HTMLElement,
    private readonly scoreHost: HTMLElement,
  ) {
    this.observer = new ResizeObserver(() => {
      this.measure();
      this.update(this.scoreQuarter);
    });
    this.observer.observe(viewport);
    this.observer.observe(contentClip);
    this.observer.observe(scoreHost);
    this.measure();
  }

  setAnchors(anchors: VerticalCameraAnchor[]): void {
    this.systems = systemsFromAnchors(anchors);
    this.measure();
    this.lastOffset = null;
    this.update(this.scoreQuarter);
  }

  update(scoreQuarter: number): void {
    this.scoreQuarter = scoreQuarter;
    const offset = cameraOffsetForSystems(
      this.systems,
      scoreQuarter,
      this.viewportHeight,
      this.scoreHeight,
      SCORE_CAMERA_FOCUS_RATIO,
      this.contentTop,
    );
    if (offset === this.lastOffset) return;
    this.viewport.style.setProperty("--score-camera-offset-y", `${-offset}px`);
    this.scoreHost.style.transform = "translateY(var(--score-camera-offset-y))";
    this.lastOffset = offset;
  }

  private measure(): void {
    this.viewportHeight = this.contentClip.clientHeight;
    this.scoreHeight = this.contentClip.scrollHeight;
    this.contentTop = Math.max(0, this.scoreHost.offsetTop);
  }

  dispose(): void {
    this.observer.disconnect();
    this.scoreHost.style.removeProperty("transform");
    this.viewport.style.removeProperty("--score-camera-offset-y");
    this.systems = [];
    this.lastOffset = null;
  }
}
