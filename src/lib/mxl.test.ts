import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractMusicXml, summarizeMusicXml } from "./mxl";

const fixture = path.resolve(process.cwd(), "ode-to-joy", "ode-to-joy-easy-variation.mxl");

describe("MXL parser", () => {
  it("extracts and summarizes the bundled Ode to Joy score", () => {
    const source = readFileSync(fixture);
    const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
    const xml = extractMusicXml(buffer);
    const summary = summarizeMusicXml(xml);

    expect(xml).toContain("<score-partwise");
    expect(summary.title).toContain("Ode to Joy");
    expect(summary.partNames).toContain("Piano");
    expect(summary.measureCount).toBeGreaterThan(0);
    expect(summary.sourceSoftware).toContain("MuseScore");
  });

  it("rejects data that is not a ZIP/MXL container", () => {
    expect(() => extractMusicXml(new TextEncoder().encode("not a zip").buffer)).toThrow(/MXL\/ZIP/);
  });
});
