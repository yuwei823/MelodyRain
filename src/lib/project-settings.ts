import { DARK_TITLE_COLOR, type TitleColorMode } from "./title-color";
import type { FrameColorRange } from "./frame-color-ranges";

export const PROJECT_SETTINGS_FILE_NAME = "melody-rain.settings.json";
export const PROJECT_SETTINGS_VERSION = 5 as const;
export type BackgroundMode = "image" | "color";
export type ConnectedNoteMode = "together" | "expand";

export interface NoteFrameEffectSettings {
  mixStrengthPercent: number;
  ranges: FrameColorRange[];
}

export interface ProjectSettings {
  version: typeof PROJECT_SETTINGS_VERSION;
  title: string;
  titleColor: string;
  titleColorMode: TitleColorMode;
  measuresPerSystem: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  backgroundImageFile: string | null;
  maskBlackMixPercent: number;
  paperTransparencyPercent: number;
  connectedNoteMode: ConnectedNoteMode;
  noteFrameEffect: NoteFrameEffectSettings;
}

type SettingsRecord = Record<string, unknown>;

function frameColorRanges(value: unknown): FrameColorRange[] {
  if (!Array.isArray(value)) throw new Error("noteFrameEffect.ranges must be an array / 帧着色范围必须是数组");
  const ranges = value.map((entry, index) => {
    const range = record(entry);
    if (typeof range.id !== "string" || !range.id) throw new Error(`noteFrameEffect.ranges[${index}].id is invalid`);
    if (!Number.isInteger(range.startFrame) || !Number.isInteger(range.endFrame)
      || (range.startFrame as number) < 0 || (range.endFrame as number) <= (range.startFrame as number)) {
      throw new Error(`noteFrameEffect.ranges[${index}] has an invalid frame range / 帧范围无效`);
    }
    if (range.mode !== "solid" && range.mode !== "rainbow") throw new Error(`noteFrameEffect.ranges[${index}].mode is invalid`);
    return { id: range.id, startFrame: range.startFrame as number, endFrame: range.endFrame as number,
      mode: range.mode as FrameColorRange["mode"], color: color(range.color, `noteFrameEffect.ranges[${index}].color`) };
  });
  const ordered = [...ranges].sort((left, right) => left.startFrame - right.startFrame);
  if (ordered.some((range, index) => index > 0 && ordered[index - 1]!.endFrame > range.startFrame)) {
    throw new Error("noteFrameEffect.ranges must not overlap / 帧着色范围不能重叠");
  }
  return ranges;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings must contain a JSON object / 参数文件内容必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}

function currentProjectSettings(settings: SettingsRecord): SettingsRecord {
  if (!Number.isInteger(settings.version)) {
    throw new Error("Settings file has no valid version / 参数文件缺少有效的版本号");
  }
  if (settings.version !== PROJECT_SETTINGS_VERSION) {
    throw new Error(`Unsupported settings version / 不支持的参数文件版本：${settings.version}`);
  }
  return settings;
}

function percent(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a number / 必须是数字`);
  return Math.min(100, Math.max(0, Math.round(value)));
}

function color(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${field} must be a six-digit hex color / 必须是六位十六进制颜色`);
  }
  return value.toUpperCase();
}

export function parseProjectSettings(text: string): ProjectSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Settings file is not valid JSON / 参数文件不是有效的 JSON");
  }
  const value = currentProjectSettings(record(parsed));
  const noteFrameEffect = record(value.noteFrameEffect);
  if (typeof value.title !== "string") throw new Error("title must be a string / 必须是字符串");
  if (value.backgroundMode !== "image" && value.backgroundMode !== "color") {
    throw new Error("Invalid backgroundMode / backgroundMode 无效");
  }
  if (value.connectedNoteMode !== "together" && value.connectedNoteMode !== "expand") {
    throw new Error("Invalid connectedNoteMode / connectedNoteMode 无效");
  }
  if (value.titleColorMode !== undefined && value.titleColorMode !== "auto" && value.titleColorMode !== "custom") {
    throw new Error("Invalid titleColorMode / titleColorMode 无效");
  }
  const measuresPerSystem = percent(value.measuresPerSystem, "measuresPerSystem");
  if (measuresPerSystem < 1 || measuresPerSystem > 6) throw new Error("measuresPerSystem must be between 1 and 6 / 必须在 1 到 6 之间");
  if (value.backgroundImageFile !== null && typeof value.backgroundImageFile !== "string") {
    throw new Error("backgroundImageFile must be a filename or null / 必须是文件名或 null");
  }
  return {
    version: PROJECT_SETTINGS_VERSION,
    title: value.title,
    titleColor: value.titleColor === undefined ? DARK_TITLE_COLOR : color(value.titleColor, "titleColor"),
    titleColorMode: value.titleColorMode === "custom" ? "custom" : "auto",
    measuresPerSystem,
    backgroundMode: value.backgroundMode,
    backgroundColor: color(value.backgroundColor, "backgroundColor"),
    backgroundImageFile: value.backgroundImageFile,
    maskBlackMixPercent: percent(value.maskBlackMixPercent, "maskBlackMixPercent"),
    paperTransparencyPercent: percent(value.paperTransparencyPercent, "paperTransparencyPercent"),
    connectedNoteMode: value.connectedNoteMode,
    noteFrameEffect: {
      mixStrengthPercent: percent(noteFrameEffect.mixStrengthPercent, "noteFrameEffect.mixStrengthPercent"),
      ranges: frameColorRanges(noteFrameEffect.ranges),
    },
  };
}

export function serializeProjectSettings(settings: ProjectSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function findProjectSettingsFile(files: File[]): File | null {
  return files.find((file) => file.name.toLowerCase() === PROJECT_SETTINGS_FILE_NAME) ?? null;
}
