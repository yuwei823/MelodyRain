import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PerformanceEffectConfig, type PerformanceEffectMode } from "../lib/performance-effect-layer";
import {
  PROJECT_SETTINGS_VERSION,
  type BackgroundMode,
  type ConnectedNoteMode,
  type ProjectSettings,
} from "../lib/project-settings";
import { PORTRAIT_RENDER_PROFILE } from "../lib/render-profile";
import type { ScoreMaskSource } from "../lib/score-mask-layer";
import {
  DARK_TITLE_COLOR,
  LIGHT_TITLE_COLOR,
  readableTitleColorForImage,
  readableTitleColorForSolid,
  type TitleColorMode,
} from "../lib/title-color";
import type { LoadedProject } from "./use-project-loader";

const DEFAULT_BACKGROUND_COLOR = "#000000";
const DEFAULT_MASK_BLACK_MIX_PERCENT = 40;
const DEFAULT_PAPER_TRANSPARENCY_PERCENT = 10;
const DEFAULT_PERFORMANCE_MIX_COLOR = "#1CAEE8";
const DEFAULT_PERFORMANCE_MIX_PERCENT = 50;

export function useProjectVisualSettings() {
  const [customTitle, setCustomTitle] = useState("");
  const [titleColor, setTitleColor] = useState(DARK_TITLE_COLOR);
  const [titleColorMode, setTitleColorMode] = useState<TitleColorMode>("auto");
  const [measuresPerSystem, setMeasuresPerSystem] = useState(PORTRAIT_RENDER_PROFILE.measuresPerSystem);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("image");
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);
  const [maskBlackMixPercent, setMaskBlackMixPercent] = useState(DEFAULT_MASK_BLACK_MIX_PERCENT);
  const [paperTransparencyPercent, setPaperTransparencyPercent] = useState(DEFAULT_PAPER_TRANSPARENCY_PERCENT);
  const [performanceEffectMode, setPerformanceEffectMode] = useState<PerformanceEffectMode>("mask");
  const [performanceMixColor, setPerformanceMixColor] = useState(DEFAULT_PERFORMANCE_MIX_COLOR);
  const [performanceMixPercent, setPerformanceMixPercent] = useState(DEFAULT_PERFORMANCE_MIX_PERCENT);
  const [connectedNoteMode, setConnectedNoteMode] = useState<ConnectedNoteMode>("together");
  const [selectedBackgroundIndex, setSelectedBackgroundIndex] = useState(0);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const projectBackgroundsRef = useRef<File[]>([]);

  const applyProjectSettings = useCallback((settings: ProjectSettings) => {
    setCustomTitle(settings.title);
    setTitleColor(settings.titleColor);
    setTitleColorMode(settings.titleColorMode);
    setMeasuresPerSystem(settings.measuresPerSystem);
    setBackgroundColor(settings.backgroundColor);
    setMaskBlackMixPercent(settings.maskBlackMixPercent);
    setPaperTransparencyPercent(settings.paperTransparencyPercent);
    setPerformanceEffectMode(settings.performanceEffectMode);
    setPerformanceMixColor(settings.performanceMixColor);
    setPerformanceMixPercent(settings.performanceMixPercent);
    setConnectedNoteMode(settings.connectedNoteMode);
    const backgroundIndex = settings.backgroundImageFile
      ? projectBackgroundsRef.current.findIndex((file) => file.name === settings.backgroundImageFile)
      : -1;
    setSelectedBackgroundIndex(Math.max(0, backgroundIndex));
    setBackgroundMode(settings.backgroundMode === "image" && backgroundIndex >= 0 ? "image" : "color");
  }, []);

  const adoptProjectSettings = useCallback((project: LoadedProject) => {
    projectBackgroundsRef.current = project.backgrounds;
    if (project.settings) {
      applyProjectSettings(project.settings);
      return;
    }
    setCustomTitle("");
    setTitleColor(DARK_TITLE_COLOR);
    setTitleColorMode("auto");
    setMeasuresPerSystem(PORTRAIT_RENDER_PROFILE.measuresPerSystem);
    setBackgroundColor(DEFAULT_BACKGROUND_COLOR);
    setMaskBlackMixPercent(DEFAULT_MASK_BLACK_MIX_PERCENT);
    setPaperTransparencyPercent(DEFAULT_PAPER_TRANSPARENCY_PERCENT);
    setPerformanceEffectMode("mask");
    setPerformanceMixColor(DEFAULT_PERFORMANCE_MIX_COLOR);
    setPerformanceMixPercent(DEFAULT_PERFORMANCE_MIX_PERCENT);
    setConnectedNoteMode("together");
    setSelectedBackgroundIndex(0);
    setBackgroundMode(project.backgrounds.length > 0 ? "image" : "color");
  }, [applyProjectSettings]);

  const selectedBackgroundFile = projectBackgroundsRef.current[selectedBackgroundIndex] ?? null;
  useEffect(() => {
    if (!selectedBackgroundFile) {
      setBackgroundImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedBackgroundFile);
    setBackgroundImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedBackgroundFile]);

  const maskSource = useMemo<ScoreMaskSource>(() => (
    backgroundMode === "image" && backgroundImageUrl
      ? { kind: "image", url: backgroundImageUrl }
      : { kind: "color", color: backgroundColor }
  ), [backgroundColor, backgroundImageUrl, backgroundMode]);

  useEffect(() => {
    if (titleColorMode !== "auto") return;
    let cancelled = false;
    if (maskSource.kind === "color") {
      setTitleColor(readableTitleColorForSolid(maskSource.color));
      return;
    }
    void readableTitleColorForImage(maskSource.url)
      .then((color) => { if (!cancelled) setTitleColor(color); })
      .catch(() => { if (!cancelled) setTitleColor(LIGHT_TITLE_COLOR); });
    return () => { cancelled = true; };
  }, [maskSource, titleColorMode]);

  const performanceEffectConfig = useMemo<PerformanceEffectConfig>(() => ({
    mode: performanceEffectMode,
    mixColor: performanceMixColor,
    mixAmount: performanceMixPercent / 100,
  }), [performanceEffectMode, performanceMixColor, performanceMixPercent]);

  const currentProjectSettings = useMemo<ProjectSettings>(() => ({
    version: PROJECT_SETTINGS_VERSION,
    title: customTitle,
    titleColor,
    titleColorMode,
    measuresPerSystem,
    backgroundMode,
    backgroundColor,
    backgroundImageFile: selectedBackgroundFile?.name ?? null,
    maskBlackMixPercent,
    paperTransparencyPercent,
    performanceEffectMode,
    performanceMixColor,
    performanceMixPercent,
    connectedNoteMode,
  }), [backgroundColor, backgroundMode, customTitle, maskBlackMixPercent, measuresPerSystem,
    paperTransparencyPercent, performanceEffectMode, performanceMixColor, performanceMixPercent,
    selectedBackgroundFile, titleColor, titleColorMode, connectedNoteMode]);

  return {
    customTitle, setCustomTitle, titleColor, setTitleColor, titleColorMode, setTitleColorMode,
    measuresPerSystem, setMeasuresPerSystem, backgroundMode, setBackgroundMode, backgroundColor,
    setBackgroundColor, maskBlackMixPercent, setMaskBlackMixPercent, paperTransparencyPercent,
    setPaperTransparencyPercent, performanceEffectMode, setPerformanceEffectMode, performanceMixColor,
    setPerformanceMixColor, performanceMixPercent, setPerformanceMixPercent, selectedBackgroundIndex,
    setSelectedBackgroundIndex, maskSource, performanceEffectConfig, currentProjectSettings,
    connectedNoteMode, setConnectedNoteMode,
    applyProjectSettings, adoptProjectSettings,
  };
}
