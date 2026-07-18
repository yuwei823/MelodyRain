import type { BackgroundMode } from "../components/control-panel";
import type { PerformanceEffectMode } from "./performance-effect-layer";
import { DARK_TITLE_COLOR, type TitleColorMode } from "./title-color";

export const PROJECT_SETTINGS_FILE_NAME = "melody-rain.settings.json";

export interface ProjectSettings {
  version: 1;
  title: string;
  titleColor: string;
  titleColorMode: TitleColorMode;
  measuresPerSystem: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  backgroundImageFile: string | null;
  maskBlackMixPercent: number;
  paperTransparencyPercent: number;
  performanceEffectMode: PerformanceEffectMode;
  performanceMixColor: string;
  performanceMixPercent: number;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("参数文件内容必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}

function percent(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} 必须是数字`);
  return Math.min(100, Math.max(0, Math.round(value)));
}

function color(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${field} 必须是六位十六进制颜色`);
  }
  return value.toUpperCase();
}

export function parseProjectSettings(text: string): ProjectSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("参数文件不是有效的 JSON");
  }
  const value = record(parsed);
  if (value.version !== 1) throw new Error("不支持的参数文件版本");
  if (typeof value.title !== "string") throw new Error("title 必须是字符串");
  if (value.backgroundMode !== "image" && value.backgroundMode !== "color") {
    throw new Error("backgroundMode 无效");
  }
  if (value.performanceEffectMode !== "mask" && value.performanceEffectMode !== "rainbow") {
    throw new Error("performanceEffectMode 无效");
  }
  if (value.titleColorMode !== undefined && value.titleColorMode !== "auto" && value.titleColorMode !== "custom") {
    throw new Error("titleColorMode 无效");
  }
  const measuresPerSystem = percent(value.measuresPerSystem, "measuresPerSystem");
  if (measuresPerSystem < 1 || measuresPerSystem > 6) throw new Error("measuresPerSystem 必须在 1 到 6 之间");
  if (value.backgroundImageFile !== null && typeof value.backgroundImageFile !== "string") {
    throw new Error("backgroundImageFile 必须是文件名或 null");
  }
  return {
    version: 1,
    title: value.title,
    titleColor: value.titleColor === undefined ? DARK_TITLE_COLOR : color(value.titleColor, "titleColor"),
    titleColorMode: value.titleColorMode === "custom" ? "custom" : "auto",
    measuresPerSystem,
    backgroundMode: value.backgroundMode,
    backgroundColor: color(value.backgroundColor, "backgroundColor"),
    backgroundImageFile: value.backgroundImageFile,
    maskBlackMixPercent: percent(value.maskBlackMixPercent, "maskBlackMixPercent"),
    paperTransparencyPercent: percent(value.paperTransparencyPercent, "paperTransparencyPercent"),
    performanceEffectMode: value.performanceEffectMode,
    performanceMixColor: color(value.performanceMixColor, "performanceMixColor"),
    performanceMixPercent: percent(value.performanceMixPercent, "performanceMixPercent"),
  };
}

export function serializeProjectSettings(settings: ProjectSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function findProjectSettingsFile(files: File[]): File | null {
  return files.find((file) => file.name.toLowerCase() === PROJECT_SETTINGS_FILE_NAME) ?? null;
}
