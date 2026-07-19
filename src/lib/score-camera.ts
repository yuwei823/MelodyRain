export interface VerticalCameraAnchor {
  scoreQuarter: number;
  x: number;
  y: number;
  height?: number;
}

interface ScoreSystem {
  startQuarter: number;
  centerY: number;
}

interface WorkingSystem extends ScoreSystem {
  top: number;
  bottom: number;
  lastX: number;
}

export const SCORE_SYSTEM_TRANSITION_QUARTERS = 0.5;

function scoreSystems(anchors: VerticalCameraAnchor[]): ScoreSystem[] {
  const columns = new Map<number, VerticalCameraAnchor[]>();
  anchors.forEach((anchor) => {
    const key = Math.round(anchor.scoreQuarter * 1_000_000);
    columns.set(key, [...(columns.get(key) ?? []), anchor]);
  });
  const orderedColumns = [...columns.values()]
    .map((entries) => ({
      scoreQuarter: entries[0]!.scoreQuarter,
      x: entries.reduce((sum, entry) => sum + entry.x, 0) / entries.length,
      top: Math.min(...entries.map((entry) => entry.y)),
      bottom: Math.max(...entries.map((entry) => entry.y + (entry.height ?? 0))),
    }))
    .sort((left, right) => left.scoreQuarter - right.scoreQuarter);
  const systems: WorkingSystem[] = [];
  orderedColumns.forEach((column) => {
    const current = systems.at(-1);
    // A return to the left identifies the first musical position of a new row.
    if (!current || column.x < current.lastX - 12) {
      systems.push({
        startQuarter: column.scoreQuarter,
        centerY: (column.top + column.bottom) / 2,
        top: column.top,
        bottom: column.bottom,
        lastX: column.x,
      });
      return;
    }
    current.top = Math.min(current.top, column.top);
    current.bottom = Math.max(current.bottom, column.bottom);
    current.centerY = (current.top + current.bottom) / 2;
    current.lastX = column.x;
  });
  return systems;
}

function smoothstep(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Keeps the active score row at the vertical center. A short deterministic
 * transition follows each row change, while both the opening and score-bottom
 * limits are spatially clamped.
 */
export function systemFollowingCameraOffset(
  anchors: VerticalCameraAnchor[],
  scoreQuarter: number,
  viewportHeight: number,
  scoreHeight: number,
  contentTop = 0,
  transitionQuarters = SCORE_SYSTEM_TRANSITION_QUARTERS,
): number {
  const systems = scoreSystems(anchors);
  const maxOffset = Math.max(0, scoreHeight - viewportHeight);
  if (systems.length === 0 || viewportHeight <= 0 || maxOffset <= 0) return 0;
  let systemIndex = 0;
  for (let index = 1; index < systems.length; index += 1) {
    if (systems[index]!.startQuarter > scoreQuarter) break;
    systemIndex = index;
  }
  const system = systems[systemIndex]!;
  const previousSystem = systems[systemIndex - 1];
  const centeredOffset = (target: ScoreSystem) => contentTop + target.centerY - viewportHeight / 2;
  let desiredOffset = centeredOffset(system);
  if (previousSystem && transitionQuarters > 0) {
    const availableQuarters = Math.max(0, system.startQuarter - previousSystem.startQuarter);
    const duration = Math.min(transitionQuarters, availableQuarters / 2);
    if (duration > 0 && scoreQuarter < system.startQuarter + duration) {
      const progress = smoothstep((scoreQuarter - system.startQuarter) / duration);
      const previousOffset = centeredOffset(previousSystem);
      desiredOffset = previousOffset + (desiredOffset - previousOffset) * progress;
    }
  }
  return Math.max(0, Math.min(maxOffset, desiredOffset));
}

export class ScoreCamera {
  private anchors: VerticalCameraAnchor[] = [];
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
    this.anchors = anchors;
    this.measure();
    this.lastOffset = null;
    this.update(this.scoreQuarter);
  }

  update(scoreQuarter: number): void {
    this.scoreQuarter = scoreQuarter;
    const offset = systemFollowingCameraOffset(
      this.anchors,
      scoreQuarter,
      this.viewportHeight,
      this.scoreHeight,
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
    this.anchors = [];
    this.lastOffset = null;
  }
}
