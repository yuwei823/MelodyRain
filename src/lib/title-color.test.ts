import { describe, expect, it } from "vitest";
import {
  DARK_TITLE_COLOR,
  LIGHT_TITLE_COLOR,
  readableTitleColorForSolid,
  rgbFromHex,
} from "./title-color";

describe("smart title color", () => {
  it("uses dark text on a light background", () => {
    expect(readableTitleColorForSolid("#F2D6DA")).toBe(DARK_TITLE_COLOR);
  });

  it("uses light text on a dark background", () => {
    expect(readableTitleColorForSolid("#07111F")).toBe(LIGHT_TITLE_COLOR);
  });

  it("parses six-digit hex colors case-insensitively", () => {
    expect(rgbFromHex("#1cAeE8")).toEqual({ red: 28, green: 174, blue: 232 });
    expect(rgbFromHex("blue")).toBeNull();
  });
});
