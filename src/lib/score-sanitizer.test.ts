import { describe, expect, it } from "vitest";
import {
  removePedalMarkings,
  removeOctaveShiftMarkings,
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

    expect(sanitized).toContain(`tempo="120"`);
    expect(sanitized).toContain(`dynamics="80"`);
    expect(sanitized).not.toMatch(/(?:damper|sostenuto|soft)-pedal/i);
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
    expect(sanitized).toMatch(/<m:note(?:\s*\/|>)/);
  });

  it("removes 8va and 8vb display directions while preserving notes", () => {
    const xml = `<measure>
      <direction placement="above"><direction-type><octave-shift type="down" size="8" number="1"/></direction-type><staff>1</staff></direction>
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>4</duration></note>
      <direction placement="below"><direction-type><octave-shift type="stop" size="8" number="1"/></direction-type><staff>1</staff></direction>
    </measure>`;
    const sanitized = removeOctaveShiftMarkings(xml);

    expect(sanitized).not.toMatch(/<octave-shift\b/i);
    expect(sanitized).not.toMatch(/<direction\b/i);
    expect(sanitized).toContain("<octave>6</octave>");
    expect(sanitized).toContain("<duration>4</duration>");
  });

  it("preserves non-target content in a mixed direction", () => {
    const xml = `<measure><direction placement="below"><direction-type>
      <pedal type="start"/><wedge type="crescendo"/><dynamics><mf/></dynamics>
    </direction-type><staff>1</staff></direction></measure>`;
    const sanitized = removePedalMarkings(xml);

    expect(sanitized).not.toMatch(/<pedal\b/i);
    expect(sanitized).toContain(`<wedge type="crescendo"/>`);
    expect(sanitized).toContain(`<dynamics><mf/></dynamics>`);
    expect(sanitized).toContain(`<staff>1</staff>`);
  });

  it("does not mistake escaped text or comments for removable elements", () => {
    const xml = `<measure><!-- <pedal/> --><direction><direction-type><words>&lt;pedal/&gt;</words></direction-type></direction></measure>`;
    const sanitized = sanitizeScoreMusicXml(xml);

    expect(sanitized).toContain("&lt;pedal/&gt;");
    expect(sanitized).toContain("<words>");
  });

  it("rejects malformed XML with a useful error", () => {
    expect(() => sanitizeScoreMusicXml(`<measure><note></measure>`)).toThrow(/MusicXML 无效/);
  });
});
