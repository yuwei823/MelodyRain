// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ScoreRenderer } from "./score-renderer";

const PIANO_WITH_LEDGER_LINES = `<score-partwise version="4.0">
  <work><work-title>ScoreRenderer integration fixture</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>2</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>7</octave></pitch>
        <duration>4</duration><voice>1</voice><type>quarter</type><stem>down</stem><staff>1</staff>
      </note>
      <note>
        <pitch><step>G</step><octave>5</octave></pitch>
        <duration>2</duration><voice>1</voice><type>eighth</type><stem>up</stem><staff>1</staff><beam number="1">begin</beam>
      </note>
      <note>
        <pitch><step>A</step><octave>5</octave></pitch>
        <duration>2</duration><voice>1</voice><type>eighth</type><stem>up</stem><staff>1</staff><beam number="1">end</beam>
      </note>
      <note><rest/><duration>8</duration><voice>1</voice><type>half</type><staff>1</staff></note>
      <backup><duration>16</duration></backup>
      <note>
        <pitch><step>C</step><octave>2</octave></pitch>
        <duration>16</duration><voice>2</voice><type>whole</type><staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({ x, y, width, height }),
  } as DOMRect;
}

beforeAll(() => {
  const identityMatrix = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    inverse() {
      return this;
    },
  } as DOMMatrix;

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({
      clearRect: () => undefined,
      fillRect: () => undefined,
      measureText: (text: string) => ({
        width: text.length * 8,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      }),
      restore: () => undefined,
      save: () => undefined,
      setTransform: () => undefined,
    }),
  });

  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value(this: SVGElement) {
      const width = Number.parseFloat(this.getAttribute("width") ?? "") || 12;
      const height = Number.parseFloat(this.getAttribute("height") ?? "") || 12;
      const x = Number.parseFloat(this.getAttribute("x") ?? "") || 0;
      const y = Number.parseFloat(this.getAttribute("y") ?? "") || 0;
      return rect(x, y, width, height);
    },
  });

  Object.defineProperty(SVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: SVGElement) {
      return (this as SVGGraphicsElement).getBBox();
    },
  });

  Object.defineProperty(SVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value: () => identityMatrix,
  });

  Object.defineProperty(SVGSVGElement.prototype, "createSVGPoint", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix: DOMMatrix) {
        return {
          x: this.x * matrix.a + this.y * matrix.c + matrix.e,
          y: this.x * matrix.b + this.y * matrix.d + matrix.f,
        };
      },
    }),
  });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("ScoreRenderer MusicXML integration", () => {
  it("renders real MusicXML and registers clefs, note targets, beams and ledger lines once", async () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 1000 });
    host.getBoundingClientRect = () => rect(0, 0, 1000, 800);
    document.body.append(host);

    const result = await new ScoreRenderer(host).render(PIANO_WITH_LEDGER_LINES, 1);

    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelectorAll(".vf-clef").length).toBeGreaterThanOrEqual(2);
    expect(result.targets.map(({ pitchMidi }) => pitchMidi).sort((a, b) => a - b))
      .toEqual([36, 79, 81, 96]);
    expect(new Set(result.targets.map(({ staffIndex }) => staffIndex))).toEqual(new Set([0, 1]));
    expect(result.targets.every(({ notation }) => notation)).toBe(true);
    expect(result.targets.some(({ notation }) => (notation?.beamElements.length ?? 0) > 0)).toBe(true);

    const ledgerOwners = result.targets.filter(({ notation }) =>
      notation?.attachedElements.some((element) => element.id.endsWith("ledgers")),
    );
    expect(ledgerOwners.length).toBeGreaterThanOrEqual(2);
    for (const { notation } of ledgerOwners) {
      const attached = notation?.attachedElements ?? [];
      expect(new Set(attached).size).toBe(attached.length);
      expect(attached.some((element, index) =>
        attached.some((candidate, candidateIndex) => candidateIndex !== index && candidate.contains(element)),
      )).toBe(false);
    }

    expect(result.maskElements.length).toBeGreaterThan(0);
    expect(result.restSymbols).toHaveLength(1);
  });
});
