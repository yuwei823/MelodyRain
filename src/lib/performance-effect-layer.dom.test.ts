// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceEffectLayer } from "./performance-effect-layer";

function bounds(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    toJSON: () => ({ width, height }),
  } as DOMRect;
}

describe("PerformanceEffectLayer mode isolation", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;

  beforeEach(() => {
    frames.clear();
    nextFrame = 1;
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("never writes rainbow paint while masked and restores it when switching back to mask", () => {
    const frame = document.createElement("div");
    const viewport = document.createElement("div");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    frame.getBoundingClientRect = () => bounds(800, 600);
    viewport.getBoundingClientRect = () => bounds(800, 600);
    viewport.append(frame);
    document.body.append(viewport);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const note = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGGraphicsElement;
    note.style.fill = "black";
    note.getBoundingClientRect = () => bounds(12, 8);
    Object.defineProperty(note, "getScreenCTM", { configurable: true, value: () => null });
    svg.append(note);
    frame.append(svg);

    const layer = new PerformanceEffectLayer(frame, viewport);
    layer.setVisuals({
      maskElements: [note],
      paints: [{ element: note, paint: { kind: "solid", color: "#F05D6C" } }],
    });

    expect(viewport.classList.contains("performance-mask-mode")).toBe(true);
    expect(note.classList.contains("performance-mask-source")).toBe(true);
    expect(note.style.fill).toBe("black");
    expect(frames.size).toBe(0);

    const hitGlow = viewport.querySelector<SVGGraphicsElement>(".performance-mask-hit-glow");
    expect(hitGlow).not.toBeNull();
    note.classList.add("is-hit");
    layer.update();
    expect(hitGlow!.classList.contains("is-active")).toBe(true);
    note.classList.remove("is-hit");
    layer.update();
    expect(hitGlow!.classList.contains("is-active")).toBe(false);

    layer.setConfig({ mode: "rainbow", mixColor: "#1CAEE8", mixAmount: 0.35 });
    expect(frames.size).toBe(1);
    const [frameId, callback] = frames.entries().next().value!;
    frames.delete(frameId);
    callback(performance.now());
    expect(note.style.getPropertyValue("fill")).toBe("rgb(240, 93, 108)");

    layer.setConfig({ mode: "mask", mixColor: "#1CAEE8", mixAmount: 0.35 });
    expect(note.style.fill).toBe("black");
    expect(note.style.getPropertyPriority("fill")).toBe("");
    expect(note.classList.contains("performance-mask-source")).toBe(true);

    layer.dispose();
  });

  it("keeps mask clones white when visuals are rebuilt while mask mode is active", () => {
    // The app's stylesheet hides source paint under mask mode; rebuilding the
    // clones (connected-note mode switch, resize) must not bake that
    // transparency into the alpha mask.
    const style = document.createElement("style");
    style.textContent = ".score-viewport.performance-mask-mode .rain-score-symbol {"
      + " fill: transparent !important; stroke: transparent !important; }";
    document.head.append(style);

    const frame = document.createElement("div");
    const viewport = document.createElement("div");
    viewport.classList.add("score-viewport");
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 600 },
    });
    frame.getBoundingClientRect = () => bounds(800, 600);
    viewport.getBoundingClientRect = () => bounds(800, 600);
    viewport.append(frame);
    document.body.append(viewport);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const note = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGGraphicsElement;
    note.classList.add("rain-score-symbol");
    note.style.fill = "black";
    note.getBoundingClientRect = () => bounds(12, 8);
    Object.defineProperty(note, "getScreenCTM", { configurable: true, value: () => null });
    svg.append(note);
    frame.append(svg);

    const cloneLeaf = () => viewport
      .querySelector(".performance-mask-layer mask > g")!
      .firstElementChild!.firstElementChild as SVGGraphicsElement;

    const layer = new PerformanceEffectLayer(frame, viewport);
    layer.setVisuals({ maskElements: [note], paints: [] });
    expect(cloneLeaf().style.getPropertyValue("fill")).toBe("white");

    // Second rebuild while mask mode is already active (the connected-note
    // fast path does exactly this via rainLayer.setEvents + setVisuals).
    layer.setVisuals({ maskElements: [note], paints: [] });
    expect(cloneLeaf().style.getPropertyValue("fill")).toBe("white");

    layer.dispose();
    style.remove();
  });
});
