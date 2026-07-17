import { describe, expect, it } from "vitest";
import { removePedalMarkings } from "./score-sanitizer";

describe("score sanitizer", () => {
  it("removes self-closing and paired pedal directions", () => {
    const xml = `<measure>
      <direction><direction-type><pedal type="start" line="yes" sign="no"/></direction-type></direction>
      <direction><direction-type><pedal type="change">Ped.</pedal></direction-type></direction>
      <note><pitch><step>C</step></pitch></note>
    </measure>`;

    const sanitized = removePedalMarkings(xml);
    expect(sanitized).not.toMatch(/<pedal\b/i);
    expect(sanitized).toContain("<note>");
  });

  it("removes pedal playback attributes without changing other sound attributes", () => {
    const xml = `<sound tempo="120" damper-pedal="yes" sostenuto-pedal='50' dynamics="80"/>`;
    const sanitized = removePedalMarkings(xml);

    expect(sanitized).toBe(`<sound tempo="120" dynamics="80"/>`);
  });

  it("keeps ties and slurs intact", () => {
    const xml = `<notations><tied type="start"/><slur type="start" number="1"/></notations>`;
    expect(removePedalMarkings(xml)).toBe(xml);
  });
});
