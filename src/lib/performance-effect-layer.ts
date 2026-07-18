import type { ScoreMaskSource } from "./score-mask-layer";
import {
  SVG_GRAPHICS_SELECTOR,
  clampUnit,
  createSvgElement,
  hasVisiblePaint,
  numericOpacity,
  uniqueSvgElements,
} from "./svg-graphics";

export type PitchStep = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type StemDirection = "up" | "down" | "none";
export type PerformanceEffectMode = "mask" | "rainbow";

export interface PerformanceEffectConfig {
  mode: PerformanceEffectMode;
  mixColor: string;
  mixAmount: number;
}

export interface PerformancePitchTarget {
  pitchMidi: number;
  pitchStep: PitchStep;
  stemDirection: StemDirection;
}

export interface PerformanceGradientStop {
  offset: number;
  color: string;
}

export type PerformancePaint =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; stops: PerformanceGradientStop[] };

export interface PerformancePaintAssignment {
  element: SVGGraphicsElement;
  paint: PerformancePaint;
}

export interface PerformanceVisuals {
  maskElements: SVGGraphicsElement[];
  paints: PerformancePaintAssignment[];
}

export const PERFORMANCE_RAINBOW_PALETTE: Readonly<Record<PitchStep, string>> = {
  C: "#F05D6C",
  D: "#F39A4A",
  E: "#E9C84A",
  F: "#42C99A",
  G: "#1CAEE8",
  A: "#4F6FEF",
  B: "#8357DF",
};

export const FULL_RAINBOW_STOPS: readonly PerformanceGradientStop[] = (
  Object.entries(PERFORMANCE_RAINBOW_PALETTE) as Array<[PitchStep, string]>
).map(([, color], index, entries) => ({ offset: index / (entries.length - 1), color }));

let nextPerformanceLayerId = 0;
let nextGradientId = 0;

interface OriginalPaintStyle {
  element: SVGGraphicsElement;
  fill: string;
  fillPriority: string;
  stroke: string;
  strokePriority: string;
  color: string;
  colorPriority: string;
}

interface MaskClone {
  source: SVGGraphicsElement;
  container: SVGGElement;
  content: SVGGraphicsElement;
  baseTop: number;
  baseBottom: number;
}

function paintedLeaves(element: SVGGraphicsElement): SVGGraphicsElement[] {
  const descendants = [...element.querySelectorAll<SVGGraphicsElement>(SVG_GRAPHICS_SELECTOR)];
  return element.matches(SVG_GRAPHICS_SELECTOR) ? [element, ...descendants] : descendants;
}

export function pitchStepFromFundamentalNote(value: number): PitchStep {
  const step = ({ 0: "C", 2: "D", 4: "E", 5: "F", 7: "G", 9: "A", 11: "B" } as const)[value as 0];
  return step ?? "C";
}

export function stemOwnerTarget<T extends PerformancePitchTarget>(targets: T[]): T | undefined {
  if (targets.length === 0) return undefined;
  const direction = targets.find((target) => target.stemDirection !== "none")?.stemDirection ?? "up";
  return targets.reduce((selected, target) => {
    if (direction === "down") return target.pitchMidi > selected.pitchMidi ? target : selected;
    return target.pitchMidi < selected.pitchMidi ? target : selected;
  });
}

export function normalizedGradientStops(
  points: Array<{ position: number; color: string }>,
): PerformanceGradientStop[] {
  if (points.length === 0) return FULL_RAINBOW_STOPS.map((stop) => ({ ...stop }));
  const ordered = [...points].sort((left, right) => left.position - right.position);
  const min = ordered[0]!.position;
  const max = ordered[ordered.length - 1]!.position;
  if (max <= min) return [{ offset: 0, color: ordered[0]!.color }, { offset: 1, color: ordered[0]!.color }];
  return ordered.map(({ position, color }) => ({ offset: (position - min) / (max - min), color }));
}

export function mergePerformanceVisuals(...visuals: PerformanceVisuals[]): PerformanceVisuals {
  return {
    maskElements: uniqueSvgElements(visuals.flatMap((visual) => visual.maskElements)),
    paints: visuals.flatMap((visual) => visual.paints),
  };
}

export class PerformanceEffectLayer {
  private readonly maskId = `performance-mask-${nextPerformanceLayerId++}`;
  private readonly overlay = document.createElement("div");
  private readonly svg = createSvgElement("svg");
  private readonly mask = createSvgElement("mask");
  private readonly maskGeometry = createSvgElement("g");
  private readonly colorRect = createSvgElement("rect");
  private readonly image = createSvgElement("image");
  private readonly tintRect = createSvgElement("rect");
  private readonly observer: ResizeObserver;
  private readonly originals = new Map<SVGGraphicsElement, OriginalPaintStyle>();
  private readonly gradientDefs = new Set<SVGDefsElement>();
  private readonly gradientContainers = new Map<SVGSVGElement, SVGDefsElement>();
  private readonly gradientCache = new Map<SVGSVGElement, Map<string, string>>();
  private maskClones: MaskClone[] = [];
  private maskSources: SVGGraphicsElement[] = [];
  private paints: PerformancePaintAssignment[] = [];
  private config: PerformanceEffectConfig = { mode: "mask", mixColor: "#1CAEE8", mixAmount: 0.5 };
  private rainbowPreparationIndex = 0;
  private rainbowPreparationFrame: number | null = null;
  private rainbowReady = false;
  private lastViewportWidth = 0;
  private lastViewportHeight = 0;

  constructor(
    private readonly frame: HTMLElement,
    private readonly viewport: HTMLElement,
  ) {
    this.overlay.className = "performance-mask-layer";
    this.overlay.setAttribute("aria-hidden", "true");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.mask.id = this.maskId;
    this.mask.setAttribute("maskUnits", "userSpaceOnUse");
    this.mask.setAttribute("maskContentUnits", "userSpaceOnUse");
    this.mask.setAttribute("mask-type", "alpha");
    this.mask.append(this.maskGeometry);
    const defs = createSvgElement("defs");
    defs.append(this.mask);
    this.colorRect.setAttribute("mask", `url(#${this.maskId})`);
    this.image.setAttribute("mask", `url(#${this.maskId})`);
    this.image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    this.tintRect.setAttribute("mask", `url(#${this.maskId})`);
    this.svg.append(defs, this.colorRect, this.image, this.tintRect);
    this.overlay.append(this.svg);
    this.viewport.append(this.overlay);
    this.observer = new ResizeObserver(() => {
      if (this.resize() && this.maskSources.length > 0) this.rebuildMaskClones();
      this.update();
    });
    this.observer.observe(frame);
    this.observer.observe(viewport);
    this.resize();
  }

  setVisuals(visuals: PerformanceVisuals): void {
    this.clearMaskSources();
    this.clearRainbowPaints();
    this.maskSources = uniqueSvgElements(visuals.maskElements);
    this.paints = visuals.paints;
    this.rebuildMaskClones();
    this.startRainbowPreparation();
    this.applyMode();
  }

  setSource(source: ScoreMaskSource): void {
    const isImage = source.kind === "image";
    this.image.style.display = isImage ? "block" : "none";
    this.colorRect.style.display = isImage ? "none" : "block";
    if (source.kind === "image") this.image.setAttribute("href", source.url);
    else this.colorRect.setAttribute("fill", source.color);
  }

  setConfig(config: PerformanceEffectConfig): void {
    const changedMode = config.mode !== this.config.mode;
    this.config = { ...config, mixAmount: clampUnit(config.mixAmount) };
    this.tintRect.setAttribute("fill", this.config.mixColor);
    this.tintRect.setAttribute("opacity", String(this.config.mixAmount));
    if (changedMode) {
      // Rainbow paint is written as inline `!important` SVG paint. Keeping it
      // underneath the mask can leak color during compositor-only scrolling,
      // so mask mode must always restore the source SVG's original paint.
      if (this.config.mode === "mask") this.clearRainbowPaints();
      this.applyMode();
    }
    else if (this.config.mode === "mask") this.update();
  }

  update(): void {
    if (this.config.mode !== "mask") return;
    const cameraOffset = Number.parseFloat(
      getComputedStyle(this.viewport).getPropertyValue("--score-camera-offset-y"),
    ) || 0;
    const margin = 220;
    this.maskClones.forEach(({ source, container, content, baseTop, baseBottom }) => {
      const insideViewport = baseBottom + cameraOffset >= -margin
        && baseTop + cameraOffset <= this.viewport.clientHeight + margin;
      if (!insideViewport) {
        container.style.display = "none";
        return;
      }
      const style = getComputedStyle(source);
      const visible = source.isConnected
        && style.display !== "none"
        && style.visibility !== "hidden"
        && numericOpacity(style.opacity) > 0;
      container.style.display = visible ? "" : "none";
      if (!visible) return;
      content.style.transform = source.style.transform;
      content.style.transformOrigin = source.style.transformOrigin || "0 0";
      content.style.opacity = style.opacity;
      content.style.clipPath = source.style.clipPath;
      // Keep the source's animated landing glow without restoring its blue/purple fill.
      // The clone geometry remains white, so the filter only affects the mask edge.
      content.style.filter = style.filter;
    });
  }

  dispose(): void {
    this.observer.disconnect();
    this.viewport.classList.remove("performance-mask-mode");
    this.clearMaskSources();
    this.clearRainbowPaints();
    this.overlay.remove();
    this.maskClones = [];
    this.maskSources = [];
    this.paints = [];
  }

  private applyMode(): void {
    if (this.config.mode === "mask") {
      this.viewport.classList.add("performance-mask-mode");
      this.overlay.style.display = "block";
      this.maskSources.forEach((element) => element.classList.add("performance-mask-source"));
      this.update();
      return;
    }
    if (!this.rainbowReady) {
      this.viewport.classList.add("performance-mask-mode");
      this.overlay.style.display = "block";
      this.maskSources.forEach((element) => element.classList.add("performance-mask-source"));
      this.scheduleRainbowPreparation();
      return;
    }
    this.showRainbowMode();
  }

  private showRainbowMode(): void {
    this.clearMaskSources();
    this.viewport.classList.remove("performance-mask-mode");
    this.overlay.style.display = "none";
  }

  private clearMaskSources(): void {
    this.maskSources.forEach((element) => element.classList.remove("performance-mask-source"));
  }

  private applyRainbowPaint(element: SVGGraphicsElement, paint: PerformancePaint): void {
    const value = paint.kind === "solid" ? paint.color : this.gradientValue(element, paint.stops);
    paintedLeaves(element).forEach((leaf) => {
      this.rememberPaint(leaf);
      const style = getComputedStyle(leaf);
      leaf.style.setProperty("color", paint.kind === "solid" ? paint.color : PERFORMANCE_RAINBOW_PALETTE.G, "important");
      if (hasVisiblePaint(style.fill, style.fillOpacity)) leaf.style.setProperty("fill", value, "important");
      if (hasVisiblePaint(style.stroke, style.strokeOpacity)) leaf.style.setProperty("stroke", value, "important");
    });
  }

  private rememberPaint(element: SVGGraphicsElement): void {
    if (this.originals.has(element)) return;
    this.originals.set(element, {
      element,
      fill: element.style.getPropertyValue("fill"),
      fillPriority: element.style.getPropertyPriority("fill"),
      stroke: element.style.getPropertyValue("stroke"),
      strokePriority: element.style.getPropertyPriority("stroke"),
      color: element.style.getPropertyValue("color"),
      colorPriority: element.style.getPropertyPriority("color"),
    });
  }

  private clearRainbowPaints(): void {
    if (this.rainbowPreparationFrame !== null) {
      cancelAnimationFrame(this.rainbowPreparationFrame);
      this.rainbowPreparationFrame = null;
    }
    this.originals.forEach(({ element, fill, fillPriority, stroke, strokePriority, color, colorPriority }) => {
      if (fill) element.style.setProperty("fill", fill, fillPriority);
      else element.style.removeProperty("fill");
      if (stroke) element.style.setProperty("stroke", stroke, strokePriority);
      else element.style.removeProperty("stroke");
      if (color) element.style.setProperty("color", color, colorPriority);
      else element.style.removeProperty("color");
    });
    this.originals.clear();
    this.gradientDefs.forEach((defs) => defs.remove());
    this.gradientDefs.clear();
    this.gradientContainers.clear();
    this.gradientCache.clear();
    this.rainbowPreparationIndex = 0;
    this.rainbowReady = false;
  }

  private startRainbowPreparation(): void {
    this.rainbowPreparationIndex = 0;
    this.rainbowReady = this.paints.length === 0;
    if (this.config.mode === "rainbow" && !this.rainbowReady) this.scheduleRainbowPreparation();
  }

  private scheduleRainbowPreparation(): void {
    if (this.config.mode !== "rainbow" || this.rainbowReady || this.rainbowPreparationFrame !== null) return;
    this.rainbowPreparationFrame = requestAnimationFrame(() => {
      this.rainbowPreparationFrame = null;
      const startedAt = performance.now();
      const batch: PerformancePaintAssignment[] = [];
      while (
        this.rainbowPreparationIndex < this.paints.length
        && batch.length < 40
        && (batch.length === 0 || performance.now() - startedAt < 6)
      ) {
        batch.push(this.paints[this.rainbowPreparationIndex++]!);
      }

      const maskedOwners = uniqueSvgElements(batch.flatMap(({ element }) => {
        const owner = element.closest<SVGGraphicsElement>(".performance-mask-source");
        return owner ? [owner] : [];
      }));
      const hadMaskMode = this.viewport.classList.contains("performance-mask-mode");
      if (hadMaskMode) this.viewport.classList.remove("performance-mask-mode");
      maskedOwners.forEach((element) => element.classList.remove("performance-mask-source"));
      batch.forEach(({ element, paint }) => this.applyRainbowPaint(element, paint));
      maskedOwners.forEach((element) => element.classList.add("performance-mask-source"));
      if (hadMaskMode) this.viewport.classList.add("performance-mask-mode");

      this.rainbowReady = this.rainbowPreparationIndex >= this.paints.length;
      if (this.rainbowReady) {
        if (this.config.mode === "rainbow") this.showRainbowMode();
      } else {
        this.scheduleRainbowPreparation();
      }
    });
  }

  private gradientValue(element: SVGGraphicsElement, stops: PerformanceGradientStop[]): string {
    const owner = element.ownerSVGElement;
    if (!owner) return PERFORMANCE_RAINBOW_PALETTE.G;
    const signature = stops
      .map(({ offset, color }) => `${clampUnit(offset).toFixed(4)}:${color.toUpperCase()}`)
      .join("|");
    const ownerCache = this.gradientCache.get(owner) ?? new Map<string, string>();
    this.gradientCache.set(owner, ownerCache);
    const cachedId = ownerCache.get(signature);
    if (cachedId) return `url(#${cachedId})`;
    let defs = this.gradientContainers.get(owner);
    if (!defs) {
      defs = createSvgElement("defs");
      defs.classList.add("performance-gradient-defs");
      owner.prepend(defs);
      this.gradientDefs.add(defs);
      this.gradientContainers.set(owner, defs);
    }
    const gradient = createSvgElement("linearGradient");
    const id = `performance-gradient-${nextGradientId++}`;
    gradient.id = id;
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("x2", "1");
    gradient.setAttribute("y2", "0");
    stops.forEach(({ offset, color }) => {
      const stop = createSvgElement("stop");
      stop.setAttribute("offset", String(clampUnit(offset)));
      stop.setAttribute("stop-color", color);
      gradient.append(stop);
    });
    defs.append(gradient);
    ownerCache.set(signature, id);
    return `url(#${id})`;
  }

  private createMaskClone(source: SVGGraphicsElement): MaskClone {
    const previousTransform = source.style.getPropertyValue("transform");
    const previousTransformPriority = source.style.getPropertyPriority("transform");
    source.style.removeProperty("transform");
    const matrix = source.getScreenCTM();
    const bounds = source.getBoundingClientRect();
    if (previousTransform) source.style.setProperty("transform", previousTransform, previousTransformPriority);
    const viewportBounds = this.viewport.getBoundingClientRect();
    const cameraOffset = Number.parseFloat(
      getComputedStyle(this.viewport).getPropertyValue("--score-camera-offset-y"),
    ) || 0;
    const content = source.cloneNode(true) as SVGGraphicsElement;
    [content, ...content.querySelectorAll<SVGElement>("[id]")].forEach((element) => element.removeAttribute("id"));
    content.removeAttribute("class");
    content.removeAttribute("style");
    content.removeAttribute("transform");
    const sourceLeaves = paintedLeaves(source);
    const cloneLeaves = paintedLeaves(content);
    sourceLeaves.forEach((leaf, index) => {
      const cloneLeaf = cloneLeaves[index];
      if (!cloneLeaf) return;
      const style = getComputedStyle(leaf);
      cloneLeaf.style.setProperty("fill", hasVisiblePaint(style.fill, style.fillOpacity) ? "white" : "none", "important");
      cloneLeaf.style.setProperty("stroke", hasVisiblePaint(style.stroke, style.strokeOpacity) ? "white" : "none", "important");
      cloneLeaf.style.setProperty("opacity", "1", "important");
      cloneLeaf.style.setProperty("fill-opacity", "1", "important");
      cloneLeaf.style.setProperty("stroke-opacity", "1", "important");
    });
    const container = createSvgElement("g");
    if (matrix) {
      container.setAttribute(
        "transform",
        `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - viewportBounds.left} ${matrix.f - viewportBounds.top - cameraOffset})`,
      );
    }
    container.append(content);
    return {
      source,
      container,
      content,
      baseTop: bounds.top - viewportBounds.top - cameraOffset,
      baseBottom: bounds.bottom - viewportBounds.top - cameraOffset,
    };
  }

  private rebuildMaskClones(): void {
    const maskedSources = this.maskSources.filter((source) => source.classList.contains("performance-mask-source"));
    maskedSources.forEach((source) => source.classList.remove("performance-mask-source"));
    this.maskClones = this.maskSources.map((source) => this.createMaskClone(source));
    this.maskGeometry.replaceChildren(...this.maskClones.map(({ container }) => container));
    maskedSources.forEach((source) => source.classList.add("performance-mask-source"));
  }

  private resize(): boolean {
    const viewportWidth = Math.max(1, this.viewport.clientWidth);
    const viewportHeight = Math.max(1, this.viewport.clientHeight);
    const sizeChanged = viewportWidth !== this.lastViewportWidth || viewportHeight !== this.lastViewportHeight;
    this.lastViewportWidth = viewportWidth;
    this.lastViewportHeight = viewportHeight;
    const frameBounds = this.frame.getBoundingClientRect();
    const viewportBounds = this.viewport.getBoundingClientRect();
    const x = frameBounds.left - viewportBounds.left;
    const y = frameBounds.top - viewportBounds.top;
    this.svg.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
    this.mask.setAttribute("x", "0");
    this.mask.setAttribute("y", "0");
    this.mask.setAttribute("width", String(viewportWidth));
    this.mask.setAttribute("height", String(viewportHeight));
    [this.colorRect, this.image, this.tintRect].forEach((element) => {
      element.setAttribute("x", String(x));
      element.setAttribute("y", String(y));
      element.setAttribute("width", String(frameBounds.width));
      element.setAttribute("height", String(frameBounds.height));
    });
    return sizeChanged;
  }
}
