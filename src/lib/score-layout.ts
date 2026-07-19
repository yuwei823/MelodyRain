function directChild(element: Element, localName: string): Element | undefined {
  return [...element.children].find((child) => child.localName === localName);
}

export function applyMeasuresPerSystem(musicXml: string, measuresPerSystem: number): string {
  const count = Math.max(1, Math.round(measuresPerSystem));
  const document = new DOMParser().parseFromString(musicXml, "application/xml");
  const error = document.querySelector("parsererror");
  if (error) throw new Error(`MusicXML layout failed / MusicXML 布局处理失败：${error.textContent?.trim() ?? "Unknown error / 未知错误"}`);

  const parts = [...document.getElementsByTagName("part")];
  for (const part of parts) {
    const measures = [...part.children].filter((child) => child.localName === "measure");
    measures.forEach((measure, index) => {
      const shouldStartSystem = index > 0 && index % count === 0;
      let print = directChild(measure, "print");

      if (shouldStartSystem) {
        if (!print) {
          print = document.createElement("print");
          measure.insertBefore(print, measure.firstChild);
        }
        print.setAttribute("new-system", "yes");
      } else if (print) {
        print.removeAttribute("new-system");
      }
    });
  }

  const serialized = new XMLSerializer().serializeToString(document);
  // OSMD 2.x distinguishes inline XML from a URL by the XML declaration.
  // DOM XMLSerializer implementations commonly omit that declaration.
  return serialized.startsWith("<?xml")
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>${serialized}`;
}
