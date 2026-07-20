import { afterEach, describe, expect, it } from "vitest";
import {
  collectVisibleScoreMaskElements,
  normalizedBlackMix,
  paperOpacityFromTransparency,
  scoreViewportLayout,
  viewportRelativeSvgMatrix,
} from "./score-mask-layer";

interface FakeGraphicsOptions {
  visibility?: string;
  fill?: string;
  stroke?: string;
  width?: number;
  height?: number;
  insideDefs?: boolean;
}

const originalGetComputedStyle = globalThis.getComputedStyle;
const styles = new WeakMap<object, CSSStyleDeclaration>();

function fakeGraphics(options: FakeGraphicsOptions = {}): SVGGraphicsElement {
  const element = {
    tagName: "path",
    ownerSVGElement: null,
    closest: () => options.insideDefs ? ({} as Element) : null,
    getBBox: () => ({ width: options.width ?? 20, height: options.height ?? 20 }),
  } as unknown as SVGGraphicsElement;
  styles.set(element, {
    display: "block",
    visibility: options.visibility ?? "visible",
    opacity: "1",
    fill: options.fill ?? "rgb(0, 0, 0)",
    fillOpacity: "1",
    stroke: options.stroke ?? "none",
    strokeOpacity: "1",
  } as CSSStyleDeclaration);
  return element;
}

function collect(elements: SVGGraphicsElement[]): SVGGraphicsElement[] {
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: Element) => styles.get(element)!,
  });
  const container = { querySelectorAll: () => elements } as unknown as HTMLElement;
  return collectVisibleScoreMaskElements(container);
}

afterEach(() => {
  if (originalGetComputedStyle) {
    Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: originalGetComputedStyle });
  } else {
    Reflect.deleteProperty(globalThis, "getComputedStyle");
  }
});

describe("score mask element collection", () => {
  it("keeps visible filled glyphs and stroked staff geometry", () => {
    const glyph = fakeGraphics();
    const staffLine = fakeGraphics({ fill: "none", stroke: "rgb(0, 0, 0)", height: 0 });

    expect(collect([glyph, staffLine])).toEqual([glyph, staffLine]);
  });

  it("excludes geometry already hidden by the animated score layers", () => {
    const staticGlyph = fakeGraphics();
    const hiddenNote = fakeGraphics({ visibility: "hidden" });
    const definition = fakeGraphics({ insideDefs: true });

    expect(collect([staticGlyph, hiddenNote, definition])).toEqual([staticGlyph]);
  });
});

describe("score mask black mixing", () => {
  it("clamps the overlay amount to a valid opacity", () => {
    expect(normalizedBlackMix(-0.2)).toBe(0);
    expect(normalizedBlackMix(0.35)).toBe(0.35);
    expect(normalizedBlackMix(1.4)).toBe(1);
    expect(normalizedBlackMix(Number.NaN)).toBe(0);
  });

  it("converts paper transparency into the inverse paper opacity", () => {
    expect(paperOpacityFromTransparency(0)).toBe(1);
    expect(paperOpacityFromTransparency(0.35)).toBe(0.65);
    expect(paperOpacityFromTransparency(1)).toBe(0);
  });
});

describe("score viewport layout", () => {
  it("reads the shared toolbar and paper inset variables", () => {
    const values = new Map([
      ["--score-toolbar-height", "148px"],
      ["--score-paper-inset-right", "49px"],
      ["--score-paper-inset-bottom", "100px"],
      ["--score-paper-inset-left", "49px"],
    ]);
    const style = {
      getPropertyValue: (property: string) => values.get(property) ?? "",
    } as CSSStyleDeclaration;

    expect(scoreViewportLayout(style)).toEqual({ top: 148, right: 49, bottom: 100, left: 49 });
  });

  it("falls back to the current design-token defaults when variables are missing", () => {
    const style = {
      getPropertyValue: (_property: string) => "",
    } as CSSStyleDeclaration;

    expect(scoreViewportLayout(style)).toEqual({ top: 148, right: 49, bottom: 100, left: 49 });
  });

  it("keeps nested score geometry relative to the viewport origin", () => {
    expect(viewportRelativeSvgMatrix(
      { a: 1, b: 0, c: 0, d: 1, e: 142, f: 286 },
      { left: 100, top: 200 },
    )).toBe("matrix(1 0 0 1 42 86)");
  });
});
