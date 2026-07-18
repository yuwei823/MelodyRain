import { describe, expect, it } from "vitest";
import {
  removePedalMarkings,
  removeTupletMarkings,
  sanitizeScoreMusicXml,
} from "./score-sanitizer";

describe("score sanitizer", () => {
  it("removes self-closing and paired pedal directions", () => {
    const xml = `<measure>
      <direction><direction-type><pedal type="start" line="yes" sign="no"/></direction-type></direction>
      <direction><direction-type><pedal type="change">Ped.</pedal></direction-type></direction>
      <note><pitch><step>C</step></pitch></note>
    </measure>`;

    const sanitized = removePedalMarkings(xml);
    expect(sanitized).not.toMatch(/<pedal\b/i);
    expect(sanitized).not.toMatch(/<direction\b/i);
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

  it("removes tuplet brackets and numbers but preserves rhythmic timing", () => {
    const xml = `<note>
      <duration>2</duration>
      <time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>
      <notations><tuplet type="start" bracket="yes" show-number="actual"/><slur type="start"/></notations>
    </note>`;
    const sanitized = removeTupletMarkings(xml);

    expect(sanitized).not.toMatch(/<tuplet\b/i);
    expect(sanitized).toContain("<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>");
    expect(sanitized).toContain(`<slur type="start"/>`);
  });

  it("sanitizes namespaced pedal and tuplet display elements together", () => {
    const xml = `<m:measure>
      <m:direction><m:direction-type><m:pedal type="start" line="yes"/></m:direction-type><m:staff>1</m:staff></m:direction>
      <m:note><m:notations><m:tuplet type="start"/></m:notations></m:note>
    </m:measure>`;
    const sanitized = sanitizeScoreMusicXml(xml);

    expect(sanitized).not.toMatch(/<(?:m:)?(?:pedal|tuplet)\b/i);
    expect(sanitized).toContain("<m:note>");
  });
});
