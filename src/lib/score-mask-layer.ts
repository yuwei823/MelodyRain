import {
  SVG_GRAPHICS_SELECTOR,
  clampUnit,
  createSvgElement,
  hasVisiblePaint,
  numericOpacity,
} from "./svg-graphics";

export type ScoreMaskSource =
  | { kind: "color"; color: string }
  | { kind: "image"; url: string };

interface MaskGeometrySource {
  element: SVGGraphicsElement;
  fill: boolean;
  stroke: boolean;
  strokeWidth: string;
  strokeLinecap: string;
  strokeLinejoin: string;
  previousVisibility: string;
}

let nextMaskId = 0;

function cssPixelValue(style: CSSStyleDeclaration, property: string, fallback: number): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function normalizedBlackMix(value: number): number {
  return clampUnit(value);
}

export function paperOpacityFromTransparency(value: number): number {
  return 1 - normalizedBlackMix(value);
}

function isPageBackground(element: SVGGraphicsElement): boolean {
  if (element.tagName.toLowerCase() !== "rect") return false;
  const owner = element.ownerSVGElement;
  if (!owner) return false;
  const elementBounds = element.getBoundingClientRect();
  const ownerBounds = owner.getBoundingClientRect();
  return ownerBounds.width > 0
    && ownerBounds.height > 0
    && elementBounds.width >= ownerBounds.width * 0.9
    && elementBounds.height >= ownerBounds.height * 0.9;
}

/**
 * This runs after the note, rest and timed-score layers have hidden their SVG
 * owners. The remaining painted leaf geometry is exactly the score furniture
 * that is present during pre-roll: staff lines, every barline style, clefs,
 * key/time signatures, braces and staff connectors.
 */
export function collectVisibleScoreMaskElements(container: HTMLElement): SVGGraphicsElement[] {
  return [...container.querySelectorAll<SVGGraphicsElement>(SVG_GRAPHICS_SELECTOR)].filter((element) => {
    if (element.closest("defs,clipPath,mask,pattern")) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || numericOpacity(style.opacity) <= 0) {
      return false;
    }
    let bounds: DOMRect;
    try {
      bounds = element.getBBox();
    } catch {
      return false;
    }
    if (bounds.width <= 0 && bounds.height <= 0) return false;
    if (isPageBackground(element)) return false;
    return hasVisiblePaint(style.fill, style.fillOpacity)
      || hasVisiblePaint(style.stroke, style.strokeOpacity);
  });
}

export class ScoreMaskLayer {
  private readonly maskId = `score-static-mask-${nextMaskId++}`;
  private readonly paperClipId = `${this.maskId}-paper-clip`;
  private readonly overlay = document.createElement("div");
  private readonly svg = createSvgElement("svg");
  private readonly mask = createSvgElement("mask");
  private readonly geometry = createSvgElement("g");
  private readonly paperClip = createSvgElement("clipPath");
  private readonly paperClipRect = createSvgElement("rect");
  private readonly foreground = createSvgElement("g");
  private readonly backgroundColorRect = createSvgElement("rect");
  private readonly backgroundImage = createSvgElement("image");
  private readonly paperRect = createSvgElement("rect");
  private readonly colorRect = createSvgElement("rect");
  private readonly image = createSvgElement("image");
  private readonly blackMixRect = createSvgElement("rect");
  private readonly observer: ResizeObserver;
  private sources: MaskGeometrySource[] = [];

  constructor(
    private readonly viewport: HTMLElement,
    private readonly scoreHost: HTMLElement,
  ) {
    this.overlay.className = "score-mask-layer";
    this.overlay.setAttribute("aria-hidden", "true");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.mask.id = this.maskId;
    this.mask.setAttribute("maskUnits", "userSpaceOnUse");
    this.mask.setAttribute("maskContentUnits", "userSpaceOnUse");
    this.mask.setAttribute("mask-type", "alpha");
    this.geometry.classList.add("score-mask-geometry");
    this.mask.append(this.geometry);

    const defs = createSvgElement("defs");
    this.paperClip.id = this.paperClipId;
    this.paperClipRect.classList.add("score-paper-clip");
    this.paperClipRect.setAttribute("rx", "16");
    this.paperClipRect.setAttribute("ry", "16");
    this.paperClip.append(this.paperClipRect);
    defs.append(this.mask, this.paperClip);
    this.backgroundImage.setAttribute("preserveAspectRatio", "xMidYMid slice");
    this.paperRect.setAttribute("fill", "#eef1f5");
    this.paperRect.setAttribute("opacity", "0.9");
    this.colorRect.setAttribute("mask", `url(#${this.maskId})`);
    this.image.setAttribute("mask", `url(#${this.maskId})`);
    this.image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    this.blackMixRect.setAttribute("fill", "black");
    this.blackMixRect.setAttribute("mask", `url(#${this.maskId})`);
    this.blackMixRect.setAttribute("opacity", "0.4");
    this.foreground.setAttribute("clip-path", `url(#${this.paperClipId})`);
    this.foreground.append(this.paperRect, this.colorRect, this.image, this.blackMixRect);
    this.svg.append(
      defs,
      this.backgroundColorRect,
      this.backgroundImage,
      this.foreground,
    );
    this.overlay.append(this.svg);
    this.viewport.append(this.overlay);

    this.observer = new ResizeObserver(() => {
      this.resize();
      this.renderGeometry();
    });
    this.observer.observe(viewport);
    this.observer.observe(scoreHost);
    this.resize();
  }

  setElements(elements: SVGGraphicsElement[]): void {
    this.restoreOriginals();
    this.sources = elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        element,
        fill: hasVisiblePaint(style.fill, style.fillOpacity),
        stroke: hasVisiblePaint(style.stroke, style.strokeOpacity),
        strokeWidth: style.strokeWidth,
        strokeLinecap: style.strokeLinecap,
        strokeLinejoin: style.strokeLinejoin,
        previousVisibility: element.style.visibility,
      };
    });
    this.renderGeometry();
    this.sources.forEach(({ element }) => element.style.setProperty("visibility", "hidden"));
  }

  setSource(source: ScoreMaskSource): void {
    const isImage = source.kind === "image";
    this.backgroundImage.style.display = isImage ? "block" : "none";
    this.backgroundColorRect.style.display = isImage ? "none" : "block";
    this.image.style.display = isImage ? "block" : "none";
    this.colorRect.style.display = isImage ? "none" : "block";
    if (source.kind === "image") {
      this.backgroundImage.setAttribute("href", source.url);
      this.image.setAttribute("href", source.url);
    } else {
      this.backgroundColorRect.setAttribute("fill", source.color);
      this.colorRect.setAttribute("fill", source.color);
    }
  }

  setBlackMix(value: number): void {
    this.blackMixRect.setAttribute("opacity", String(normalizedBlackMix(value)));
  }

  setPaperTransparency(value: number): void {
    this.paperRect.setAttribute("opacity", String(paperOpacityFromTransparency(value)));
  }

  dispose(): void {
    this.observer.disconnect();
    this.restoreOriginals();
    this.overlay.remove();
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    const viewportStyle = getComputedStyle(this.viewport);
    const paperInset = {
      top: cssPixelValue(viewportStyle, "--score-paper-inset-top", 72),
      right: cssPixelValue(viewportStyle, "--score-paper-inset-right", 10),
      bottom: cssPixelValue(viewportStyle, "--score-paper-inset-bottom", 10),
      left: cssPixelValue(viewportStyle, "--score-paper-inset-left", 10),
    };
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.mask.setAttribute("x", "0");
    this.mask.setAttribute("y", "0");
    this.mask.setAttribute("width", String(width));
    this.mask.setAttribute("height", String(height));
    [
      this.backgroundColorRect,
      this.backgroundImage,
      this.paperRect,
      this.colorRect,
      this.image,
      this.blackMixRect,
    ].forEach((element) => {
      element.setAttribute("x", "0");
      element.setAttribute("y", "0");
      element.setAttribute("width", String(width));
      element.setAttribute("height", String(height));
    });
    this.paperClipRect.setAttribute("x", String(paperInset.left));
    this.paperClipRect.setAttribute("y", String(paperInset.top));
    this.paperClipRect.setAttribute(
      "width",
      String(Math.max(0, width - paperInset.left - paperInset.right)),
    );
    this.paperClipRect.setAttribute(
      "height",
      String(Math.max(0, height - paperInset.top - paperInset.bottom)),
    );
  }

  private renderGeometry(): void {
    const hostBounds = this.scoreHost.getBoundingClientRect();
    const hostLeft = hostBounds.left - this.scoreHost.offsetLeft;
    const hostTop = hostBounds.top - this.scoreHost.offsetTop;
    const clones = this.sources.flatMap((source) => {
      if (!source.element.isConnected) return [];
      const matrix = source.element.getScreenCTM();
      if (!matrix) return [];
      const clone = source.element.cloneNode(true) as SVGGraphicsElement;
      clone.removeAttribute("id");
      clone.removeAttribute("class");
      clone.removeAttribute("transform");
      clone.removeAttribute("style");
      clone.setAttribute(
        "transform",
        `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - hostLeft} ${matrix.f - hostTop})`,
      );
      clone.setAttribute("fill", source.fill ? "white" : "none");
      clone.setAttribute("stroke", source.stroke ? "white" : "none");
      clone.setAttribute("opacity", "1");
      clone.setAttribute("fill-opacity", "1");
      clone.setAttribute("stroke-opacity", "1");
      if (source.stroke) {
        clone.setAttribute("stroke-width", source.strokeWidth);
        clone.setAttribute("stroke-linecap", source.strokeLinecap);
        clone.setAttribute("stroke-linejoin", source.strokeLinejoin);
      }
      return [clone];
    });
    this.geometry.replaceChildren(...clones);
  }

  private restoreOriginals(): void {
    this.sources.forEach(({ element, previousVisibility }) => {
      if (previousVisibility) element.style.visibility = previousVisibility;
      else element.style.removeProperty("visibility");
    });
    this.sources = [];
    this.geometry.replaceChildren();
  }
}
