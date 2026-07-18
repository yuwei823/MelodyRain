import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

type XmlNode = Record<string, unknown>;

interface SanitizeRules {
  removeElements: ReadonlySet<string>;
  removeSoundAttributes?: ReadonlySet<string>;
}

const PEDAL_ELEMENTS = new Set(["pedal"]);
const PEDAL_SOUND_ATTRIBUTES = new Set(["damper-pedal", "sostenuto-pedal", "soft-pedal"]);
const TUPLET_ELEMENTS = new Set(["tuplet"]);
const OCTAVE_SHIFT_ELEMENTS = new Set(["octave-shift"]);
const EMPTY_CONTAINER_NAMES = new Set(["direction-type", "notations"]);
const DIRECTION_METADATA_NAMES = new Set(["offset", "voice", "staff"]);

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  processEntities: false,
  trimValues: false,
});

const builder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  processEntities: false,
  suppressEmptyNode: true,
  format: false,
});

function qualifiedName(node: XmlNode): string | undefined {
  return Object.keys(node).find((key) => key !== ":@");
}

function localName(name: string): string {
  return name.split(":").at(-1)?.toLowerCase() ?? name.toLowerCase();
}

function childNodes(node: XmlNode, name: string): XmlNode[] | undefined {
  const value = node[name];
  return Array.isArray(value) ? value as XmlNode[] : undefined;
}

function hasMeaningfulContent(nodes: XmlNode[]): boolean {
  return nodes.some((node) => {
    const name = qualifiedName(node);
    if (!name) return false;
    if (name === "#text") return String(node[name] ?? "").trim().length > 0;
    if (name === "#comment") return false;
    return !name.startsWith("?");
  });
}

function directionHasContent(nodes: XmlNode[]): boolean {
  return nodes.some((node) => {
    const name = qualifiedName(node);
    if (!name) return false;
    if (name === "#text") return String(node[name] ?? "").trim().length > 0;
    if (name === "#comment") return false;
    return !DIRECTION_METADATA_NAMES.has(localName(name));
  });
}

function removeSoundAttributes(node: XmlNode, names: ReadonlySet<string>): void {
  const attributes = node[":@"];
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return;
  for (const attribute of Object.keys(attributes)) {
    const unprefixed = attribute.startsWith("@_") ? attribute.slice(2) : attribute;
    if (names.has(localName(unprefixed))) delete (attributes as Record<string, unknown>)[attribute];
  }
  if (Object.keys(attributes).length === 0) delete node[":@"];
}

function sanitizeNodes(nodes: XmlNode[], rules: SanitizeRules): XmlNode[] {
  return nodes.flatMap((node) => {
    const name = qualifiedName(node);
    if (!name) return [node];
    const local = localName(name);
    if (rules.removeElements.has(local)) return [];

    const children = childNodes(node, name);
    if (children) node[name] = sanitizeNodes(children, rules);
    if (local === "sound" && rules.removeSoundAttributes) {
      removeSoundAttributes(node, rules.removeSoundAttributes);
    }

    const remainingChildren = childNodes(node, name) ?? [];
    if (EMPTY_CONTAINER_NAMES.has(local) && !hasMeaningfulContent(remainingChildren)) return [];
    if (local === "direction" && !directionHasContent(remainingChildren)) return [];
    return [node];
  });
}

function transformMusicXml(musicXml: string, rules: SanitizeRules): string {
  const validation = XMLValidator.validate(musicXml);
  if (validation !== true) {
    throw new Error(`MusicXML 无效：${validation.err.msg}（第 ${validation.err.line} 行）`);
  }
  const document = parser.parse(musicXml) as XmlNode[];
  return builder.build(sanitizeNodes(document, rules));
}

export function removePedalMarkings(musicXml: string): string {
  return transformMusicXml(musicXml, {
    removeElements: PEDAL_ELEMENTS,
    removeSoundAttributes: PEDAL_SOUND_ATTRIBUTES,
  });
}

/** Removes only printed tuplet brackets/numbers, preserving time-modification. */
export function removeTupletMarkings(musicXml: string): string {
  return transformMusicXml(musicXml, { removeElements: TUPLET_ELEMENTS });
}

/** Removes printed 8va/8vb lines without changing note pitches or timing. */
export function removeOctaveShiftMarkings(musicXml: string): string {
  return transformMusicXml(musicXml, { removeElements: OCTAVE_SHIFT_ELEMENTS });
}

export function sanitizeScoreMusicXml(musicXml: string): string {
  return transformMusicXml(musicXml, {
    removeElements: new Set([...PEDAL_ELEMENTS, ...TUPLET_ELEMENTS, ...OCTAVE_SHIFT_ELEMENTS]),
    removeSoundAttributes: PEDAL_SOUND_ATTRIBUTES,
  });
}
