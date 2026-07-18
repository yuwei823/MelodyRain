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
  const systems = systemsFromAnchors(anchors);
  const current = systems.reduce<VerticalCameraSystem>((selected, system) =>
    system.startQuarter <= scoreQuarter ? system : selected,
  systems[0]!);
  const desiredOffset = contentTop + current.centerY - viewportHeight / focusRatio;
  const maximumOffset = Math.max(0, scoreHeight - viewportHeight);
  return Math.max(0, Math.min(desiredOffset, maximumOffset));
}

export class ScoreCamera {
  private anchors: VerticalCameraAnchor[] = [];
  private scoreQuarter = 0;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly contentClip: HTMLElement,
    private readonly scoreHost: HTMLElement,
  ) {
    this.observer = new ResizeObserver(() => this.update(this.scoreQuarter));
    this.observer.observe(viewport);
    this.observer.observe(contentClip);
    this.observer.observe(scoreHost);
  }

  setAnchors(anchors: VerticalCameraAnchor[]): void {
    this.anchors = anchors;
    this.update(this.scoreQuarter);
  }

  update(scoreQuarter: number): void {
    this.scoreQuarter = scoreQuarter;
    const offset = verticalCameraOffset(
      this.anchors,
      scoreQuarter,
      this.contentClip.clientHeight,
      this.contentClip.scrollHeight,
      { contentTop: this.scoreHost.offsetTop },
    );
    this.viewport.style.setProperty("--score-camera-offset-y", `${-offset}px`);
    this.scoreHost.style.transform = "translateY(var(--score-camera-offset-y))";
  }

  dispose(): void {
    this.observer.disconnect();
    this.scoreHost.style.removeProperty("transform");
    this.viewport.style.removeProperty("--score-camera-offset-y");
    this.anchors = [];
  }
}
