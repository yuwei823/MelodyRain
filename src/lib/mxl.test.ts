import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractMusicXml, summarizeMusicXml } from "./mxl";

function createMxlFixture(): ArrayBuffer {
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles>
</container>`;
  const score = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Fixture Score</work-title></work>
  <identification><encoding><software>MuseScore Fixture</software></encoding></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><rest/><duration>4</duration></note></measure></part>
</score-partwise>`;
  const archive = zipSync({
    "META-INF/container.xml": strToU8(container),
    "score.musicxml": strToU8(score),
  });
  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
}

describe("MXL parser", () => {
  it("extracts and summarizes the bundled Ode to Joy score", () => {
    const xml = extractMusicXml(createMxlFixture());
    const summary = summarizeMusicXml(xml);

    expect(xml).toContain("<score-partwise");
    expect(summary.title).toBe("Fixture Score");
    expect(summary.partNames).toContain("Piano");
    expect(summary.measureCount).toBeGreaterThan(0);
    expect(summary.sourceSoftware).toBe("MuseScore Fixture");
  });

  it("rejects data that is not a ZIP/MXL container", () => {
    expect(() => extractMusicXml(new TextEncoder().encode("not a zip").buffer)).toThrow(/MXL\/ZIP/);
  });
});
