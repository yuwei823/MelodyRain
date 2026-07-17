const PEDAL_ELEMENT_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?pedal\b[^>]*(?:\/>|>[\s\S]*?<\/(?:(?:[A-Za-z_][\w.-]*):)?pedal\s*>)/gi;
const PEDAL_SOUND_ATTRIBUTE_PATTERN = /\s+(?:damper-pedal|sostenuto-pedal|soft-pedal)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const EMPTY_DIRECTION_TYPE_PATTERN = /<direction-type\b[^>]*>\s*<\/direction-type\s*>/gi;

export function removePedalMarkings(musicXml: string): string {
  return musicXml
    .replace(PEDAL_ELEMENT_PATTERN, "")
    .replace(PEDAL_SOUND_ATTRIBUTE_PATTERN, "")
    .replace(EMPTY_DIRECTION_TYPE_PATTERN, "");
}
