import { describe, expect, it } from "vitest";
import {
  PROJECT_SETTINGS_FILE_NAME,
  PROJECT_SETTINGS_VERSION,
  findProjectSettingsFile,
  parseProjectSettings,
  serializeProjectSettings,
  type ProjectSettings,
} from "./project-settings";

const SETTINGS: ProjectSettings = {
  version: PROJECT_SETTINGS_VERSION,
  title: "Cruel Summer",
  titleColor: "#25364A",
  titleColorMode: "auto",
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
    expect(() => parseProjectSettings(JSON.stringify({ ...SETTINGS, version: 3 }))).toThrow("版本");
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

  it("migrates version-1 files and defaults the fields introduced in version 2", () => {
    const { titleColor: _titleColor, titleColorMode: _titleColorMode, ...legacy } = SETTINGS;
    const parsed = parseProjectSettings(JSON.stringify({ ...legacy, version: 1 }));

    expect(parsed.version).toBe(PROJECT_SETTINGS_VERSION);
    expect(parsed.titleColor).toBe("#25364A");
    expect(parsed.titleColorMode).toBe("auto");
  });

  it("preserves newer fields already present in a version-1 file", () => {
    const parsed = parseProjectSettings(JSON.stringify({
      ...SETTINGS,
      version: 1,
      titleColor: "#123456",
      titleColorMode: "custom",
    }));

    expect(parsed).toMatchObject({ version: 2, titleColor: "#123456", titleColorMode: "custom" });
  });

  it("rejects files without a valid version instead of guessing their schema", () => {
    const { version: _version, ...unversioned } = SETTINGS;
    expect(() => parseProjectSettings(JSON.stringify(unversioned))).toThrow("版本");
  });
});
