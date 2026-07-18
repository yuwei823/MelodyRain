const PEDAL_ELEMENT_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?pedal\b[^>]*(?:\/>|>[\s\S]*?<\/(?:(?:[A-Za-z_][\w.-]*):)?pedal\s*>)/gi;
const PEDAL_SOUND_ATTRIBUTE_PATTERN = /\s+(?:damper-pedal|sostenuto-pedal|soft-pedal)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
const EMPTY_DIRECTION_TYPE_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?direction-type\b[^>]*>\s*<\/(?:(?:[A-Za-z_][\w.-]*):)?direction-type\s*>/gi;
const EMPTY_DIRECTION_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?direction\b[^>]*>\s*(?:<(?:(?:[A-Za-z_][\w.-]*):)?(?:offset|voice|staff)\b[^>]*>[\s\S]*?<\/(?:(?:[A-Za-z_][\w.-]*):)?(?:offset|voice|staff)\s*>\s*)*<\/(?:(?:[A-Za-z_][\w.-]*):)?direction\s*>/gi;
const TUPLET_ELEMENT_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?tuplet\b[^>]*(?:\/>|>[\s\S]*?<\/(?:(?:[A-Za-z_][\w.-]*):)?tuplet\s*>)/gi;
const EMPTY_NOTATIONS_PATTERN = /<(?:(?:[A-Za-z_][\w.-]*):)?notations\b[^>]*>\s*<\/(?:(?:[A-Za-z_][\w.-]*):)?notations\s*>/gi;

export function removePedalMarkings(musicXml: string): string {
  return musicXml
    .replace(PEDAL_ELEMENT_PATTERN, "")
    .replace(PEDAL_SOUND_ATTRIBUTE_PATTERN, "")
    .replace(EMPTY_DIRECTION_TYPE_PATTERN, "")
    .replace(EMPTY_DIRECTION_PATTERN, "");
}

/** Removes only the printed tuplet bracket/number, preserving rhythmic time-modification. */
export function removeTupletMarkings(musicXml: string): string {
  return musicXml
    .replace(TUPLET_ELEMENT_PATTERN, "")
    .replace(EMPTY_NOTATIONS_PATTERN, "");
}

export function sanitizeScoreMusicXml(musicXml: string): string {
  return removeTupletMarkings(removePedalMarkings(musicXml));
}
