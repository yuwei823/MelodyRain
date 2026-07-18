export const SVG_GRAPHICS_SELECTOR = "path,rect,line,polyline,polygon,circle,ellipse,text,use";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, name);
}

export function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function numericOpacity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function hasVisiblePaint(value: string, opacity: string): boolean {
  return value !== "none"
    && value !== "transparent"
    && value !== "rgba(0, 0, 0, 0)"
    && numericOpacity(opacity) > 0;
}

export function uniqueSvgElements(elements: SVGGraphicsElement[]): SVGGraphicsElement[] {
  return [...new Set(elements)];
}
