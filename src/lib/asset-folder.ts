export interface FolderAsset {
  name: string;
  webkitRelativePath?: string;
}

export interface MatchedProjectAssets<T extends FolderAsset> {
  score: T;
  midi: T;
  audio: T;
  backgrounds: T[];
}

const SCORE_EXTENSIONS = [".mxl", ".musicxml", ".xml"];
const MIDI_EXTENSIONS = [".mid", ".midi"];
const AUDIO_EXTENSIONS = [".mp3"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot < 0 ? name : name.slice(0, dot)).trim().toLowerCase();
}

function displayPath(asset: FolderAsset): string {
  return asset.webkitRelativePath || asset.name;
}

function sortByExtensionPriority<T extends FolderAsset>(assets: T[], extensions: string[]): T[] {
  return [...assets].sort((left, right) => {
    const extensionDifference = extensions.indexOf(extension(left.name)) - extensions.indexOf(extension(right.name));
    return extensionDifference || displayPath(left).localeCompare(displayPath(right));
  });
}

function sortBackgrounds<T extends FolderAsset>(assets: T[], projectStem?: string): T[] {
  const preferredNames = new Set(["background", "bg", "cover"]);
  return [...assets].sort((left, right) => {
    const rank = (asset: T): number => {
      const candidateStem = stem(asset.name);
      if (projectStem && candidateStem === projectStem) return 0;
      if (preferredNames.has(candidateStem)) return 1;
      return 2;
    };
    return rank(left) - rank(right) || displayPath(left).localeCompare(displayPath(right));
  });
}

export function matchProjectFolderAssets<T extends FolderAsset>(files: T[]): MatchedProjectAssets<T> {
  const visibleFiles = files.filter((file) => !file.name.startsWith(".") && !file.name.startsWith("~$"));
  const scores = sortByExtensionPriority(
    visibleFiles.filter((file) => SCORE_EXTENSIONS.includes(extension(file.name))),
    SCORE_EXTENSIONS,
  );
  const midis = sortByExtensionPriority(
    visibleFiles.filter((file) => MIDI_EXTENSIONS.includes(extension(file.name))),
    MIDI_EXTENSIONS,
  );
  const audios = sortByExtensionPriority(
    visibleFiles.filter((file) => AUDIO_EXTENSIONS.includes(extension(file.name))),
    AUDIO_EXTENSIONS,
  );
  const images = visibleFiles.filter((file) => IMAGE_EXTENSIONS.includes(extension(file.name)));

  const missing: string[] = [];
  if (scores.length === 0) missing.push("MXL/MusicXML");
  if (midis.length === 0) missing.push("MIDI");
  if (audios.length === 0) missing.push("MP3");
  if (missing.length > 0) throw new Error(`Media folder is missing / 素材文件夹缺少：${missing.join("、")}`);

  const sharedStems = [...new Set(scores.map((file) => stem(file.name)))].filter((candidate) =>
    midis.some((file) => stem(file.name) === candidate) && audios.some((file) => stem(file.name) === candidate),
  );

  if (sharedStems.length === 1) {
    const selectedStem = sharedStems[0]!;
    return {
      score: scores.find((file) => stem(file.name) === selectedStem)!,
      midi: midis.find((file) => stem(file.name) === selectedStem)!,
      audio: audios.find((file) => stem(file.name) === selectedStem)!,
      backgrounds: sortBackgrounds(images, selectedStem),
    };
  }

  if (sharedStems.length > 1) {
    throw new Error(`Multiple matching media sets found; unable to choose automatically / 素材文件夹包含多组同名资源，无法自动确定：${sharedStems.join("、")}`);
  }

  if (scores.length === 1 && midis.length === 1 && audios.length === 1) {
    return {
      score: scores[0]!,
      midi: midis[0]!,
      audio: audios[0]!,
      backgrounds: sortBackgrounds(images, stem(scores[0]!.name)),
    };
  }

  throw new Error("Multiple candidate files cannot form one unique media set / 素材文件夹内存在多个候选文件，且文件名无法组成唯一的一组资源");
}

export function assetRelativePath(asset: FolderAsset): string {
  return displayPath(asset);
}
