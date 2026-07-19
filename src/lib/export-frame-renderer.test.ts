// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createExportCanvas, exportFrameSize } from "./export-frame-renderer";

describe("export frame renderer", () => {
  it("uses the portrait export dimensions", () => {
    expect(exportFrameSize()).toEqual({ width: 1080, height: 1920 });
  });

  it("normalizes canvas dimensions to positive integers", () => {
    expect(exportFrameSize(1079.6, 0)).toEqual({ width: 1080, height: 1 });
    const canvas = createExportCanvas({ width: 320, height: 568 });
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(568);
  });
});
