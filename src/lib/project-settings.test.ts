import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
  connectedNoteMode: "expand",
  noteFrameEffect: {
    mixStrengthPercent: 62,
    transitionFrames: 15,
    ranges: [{ id: "default", startFrame: 0, endFrame: 1_000, mode: "solid", color: "#A11CE9" }],
  },
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
    expect(() => parseProjectSettings(JSON.stringify({ ...SETTINGS, version: 4 }))).toThrow("版本");
    expect(() => parseProjectSettings(JSON.stringify({
      ...SETTINGS,
      noteFrameEffect: { ...SETTINGS.noteFrameEffect, ranges: [{
        ...SETTINGS.noteFrameEffect.ranges[0]!, color: "purple",
      }] },
    })))
      .toThrow("颜色");
  });

  it("clamps percentage values from edited files", () => {
    const parsed = parseProjectSettings(JSON.stringify({
      ...SETTINGS,
      maskBlackMixPercent: 120,
      paperTransparencyPercent: -5,
      noteFrameEffect: { ...SETTINGS.noteFrameEffect, mixStrengthPercent: 42.6 },
    }));
    expect(parsed.maskBlackMixPercent).toBe(100);
    expect(parsed.paperTransparencyPercent).toBe(0);
    expect(parsed.noteFrameEffect.mixStrengthPercent).toBe(43);
  });

  it("keeps the Ode to Joy sample as a valid readable default config", () => {
    const sample = parseProjectSettings(readFileSync(
      "sample/ode-to-joy/melody-rain.settings.json",
      "utf8",
    ));

    expect(sample.version).toBe(PROJECT_SETTINGS_VERSION);
    expect(sample.noteFrameEffect.mixStrengthPercent).toBeGreaterThanOrEqual(0);
    expect(sample.noteFrameEffect.transitionFrames).toBeGreaterThanOrEqual(0);
    expect(sample.noteFrameEffect.ranges.length).toBeGreaterThan(0);
    expect(sample.noteFrameEffect.ranges[0]?.startFrame).toBe(0);
  });

  it("rejects invalid connected-note modes", () => {
    expect(() => parseProjectSettings(JSON.stringify({ ...SETTINGS, connectedNoteMode: "cascade" })))
      .toThrow("connectedNoteMode");
  });

  it("rejects files without a valid version instead of guessing their schema", () => {
    const { version: _version, ...unversioned } = SETTINGS;
    expect(() => parseProjectSettings(JSON.stringify(unversioned))).toThrow("版本");
  });
});
