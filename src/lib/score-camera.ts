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
): number {
  if (anchors.length === 0 || viewportHeight <= 0 || scoreHeight <= viewportHeight) return 0;
  const systems = systemsFromAnchors(anchors);
  const current = systems.reduce<VerticalCameraSystem>((selected, system) =>
    system.startQuarter <= scoreQuarter ? system : selected,
  systems[0]!);
  const desiredOffset = current.centerY - viewportHeight / 2;
  const maximumOffset = Math.max(0, scoreHeight - viewportHeight);
  return Math.max(0, Math.min(desiredOffset, maximumOffset));
}

export class ScoreCamera {
  private anchors: VerticalCameraAnchor[] = [];
  private scoreQuarter = 0;
  private readonly observer: ResizeObserver;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly scoreHost: HTMLElement,
  ) {
    this.observer = new ResizeObserver(() => this.update(this.scoreQuarter));
    this.observer.observe(viewport);
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
      this.viewport.clientHeight,
      this.scoreHost.scrollHeight,
    );
    this.scoreHost.style.transform = `translateY(${-offset}px)`;
  }

  dispose(): void {
    this.observer.disconnect();
    this.scoreHost.style.removeProperty("transform");
    this.anchors = [];
  }
}
