import { describe, expect, it } from "vitest";
import {
  PROJECT_SETTINGS_FILE_NAME,
  findProjectSettingsFile,
  parseProjectSettings,
  serializeProjectSettings,
  type ProjectSettings,
} from "./project-settings";

const SETTINGS: ProjectSettings = {
  version: 1,
  title: "Cruel Summer",
  measuresPerSystem: 2,
  backgroundMode: "image",
  backgroundColor: "#000000",
  backgroundImageFile: "cover.webp",
  maskBlackMixPercent: 40,
  paperTransparencyPercent: 10,
  performanceEffectMode: "mask",
  performanceMixColor: "#A11CE9",
  performanceMixPercent: 62,
};

describe("project settings", () => {
  it("round-trips every visual parameter", () => {
    expect(parseProjectSettings(serializeProjectSettings(SETTINGS))).toEqual(SETTINGS);
  });

  it("finds the standard settings file case-insensitively", () => {
    const files = [
      { name: "score.mxl" },
      { name: PROJECT_SETTINGS_FILE_NAME.toUpperCase() },
    ] as File[];
    expect(findProjectSettingsFile(files)?.name).toBe(PROJECT_SETTINGS_FILE_NAME.toUpperCase());
  });

  it("rejects unsupported versions and invalid colors", () => {
    expect(() => parseProjectSettings(JSON.stringify({ ...SETTINGS, version: 2 }))).toThrow("版本");
    expect(() => parseProjectSettings(JSON.stringify({ ...SETTINGS, performanceMixColor: "purple" })))
      .toThrow("颜色");
  });

  it("clamps percentage values from edited files", () => {
    const parsed = parseProjectSettings(JSON.stringify({
      ...SETTINGS,
      maskBlackMixPercent: 120,
      paperTransparencyPercent: -5,
      performanceMixPercent: 42.6,
    }));
    expect(parsed.maskBlackMixPercent).toBe(100);
    expect(parsed.paperTransparencyPercent).toBe(0);
    expect(parsed.performanceMixPercent).toBe(43);
  });
});
