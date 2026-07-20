import { useCallback, useEffect, useMemo, useRef } from "react";
import { ControlPanel } from "./components/control-panel";
import { PlaybackPanel } from "./components/playback-panel";
import { StagePanel } from "./components/stage-panel";
import { StatusPill } from "./components/ui/status-pill";
import { useProjectLoader, type LoadedProject } from "./hooks/use-project-loader";
import { useMediaTransport } from "./hooks/use-media-transport";
import { useProjectVisualSettings } from "./hooks/use-project-visual-settings";
import { useScoreStage } from "./hooks/use-score-stage";
import { transportSnapshotAt, type TransportSnapshot } from "./lib/transport";
import { useVideoExport } from "./hooks/use-video-export";
import { MidiTimeline } from "./lib/midi";
import { DEFAULT_FRAME_COLOR_TRANSITION_FRAMES } from "./lib/frame-color-ranges";
import { videoExportFrameCount } from "./lib/video-export";

function stateLabel(state: TransportSnapshot["state"]): string {
  return {
    idle: "Ready / 待播放",
    playing: "Playing / 播放中",
    paused: "Paused / 已暂停",
    ended: "Ended / 已结束",
  }[state];
}

export default function App() {
  const visual = useProjectVisualSettings();
  const frameColorRangeSettings = useMemo(() => ({
    transitionFrames: DEFAULT_FRAME_COLOR_TRANSITION_FRAMES,
    ranges: visual.performanceColorRanges,
  }), [visual.performanceColorRanges]);

  const handleProjectLoaded = useCallback((nextProject: LoadedProject) => {
    visual.adoptProjectSettings(nextProject);
  }, [visual.adoptProjectSettings]);
  const {
    project,
    status,
    error,
    setStatus,
    setError,
    scoreFile,
    midiFile,
    audioFile,
    backgroundFiles,
    settingsFile,
    folderName,
    folderInputRef,
    remembersFolders,
    selectAssetFolder,
    chooseAndLoadAssetFolder,
    readProjectSettings,
    saveProjectSettings,
    saveVideoToAssetFolder,
    loadExportJob,
  } = useProjectLoader({
    onProjectLoaded: handleProjectLoaded,
    onSettingsLoaded: visual.applyProjectSettings,
  });
  const stageUpdateRef = useRef<(snapshot: TransportSnapshot) => void>(() => undefined);
  const transport = useMediaTransport(project, (nextSnapshot) => stageUpdateRef.current(nextSnapshot));
  const stage = useScoreStage({ project, measuresPerSystem: visual.measuresPerSystem,
    maskSource: visual.maskSource, maskBlackMixPercent: visual.maskBlackMixPercent,
    paperTransparencyPercent: visual.paperTransparencyPercent,
    performanceEffectConfig: visual.performanceEffectConfig,
    frameColorRangeSettings,
    connectedNoteMode: visual.connectedNoteMode,
    currentSourceTimeMs: transport.currentSourceTimeMs, setStatus, setError });
  stageUpdateRef.current = stage.update;
  const {
    customTitle, setCustomTitle, titleColor, setTitleColor, titleColorMode, setTitleColorMode,
    measuresPerSystem, setMeasuresPerSystem, backgroundMode, setBackgroundMode, backgroundColor,
    setBackgroundColor, maskBlackMixPercent, setMaskBlackMixPercent, paperTransparencyPercent,
    setPaperTransparencyPercent, performanceMixPercent, setPerformanceMixPercent, selectedBackgroundIndex,
    setSelectedBackgroundIndex, currentProjectSettings,
    connectedNoteMode, setConnectedNoteMode,
    performanceColorRanges, setPerformanceColorRanges,
  } = visual;
  const { snapshot, activeNotes, audioRef } = transport;
  const { targetCount, scoreHostRef, scoreViewportRef, scoreContentClipRef } = stage;
  const exportJobId = new URLSearchParams(window.location.search).get("exportJob");

  useEffect(() => {
    if (exportJobId) void loadExportJob(exportJobId);
  }, [exportJobId, loadExportJob]);

  useEffect(() => {
    if (!exportJobId) return;
    document.body.classList.add("export-mode");
    const exportWindow = window as unknown as {
      __MELODY_RAIN_EXPORT__?: { renderFrame(timeMs: number): Promise<void> };
    };
    if (project) {
      document.documentElement.dataset.exportDurationMs = String(project.midi.durationMs);
      if (targetCount > 0) {
        const timeline = new MidiTimeline(project.midi);
        exportWindow.__MELODY_RAIN_EXPORT__ = {
          async renderFrame(timeMs: number) {
            stage.update(transportSnapshotAt(timeline, timeMs, project.midi.durationMs, 1, "playing"));
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          },
        };
      } else {
        document.documentElement.dataset.exportError = "No note targets found / 没有找到音符落点";
      }
      document.documentElement.dataset.exportReady = "true";
    }
    return () => {
      delete exportWindow.__MELODY_RAIN_EXPORT__;
      delete document.documentElement.dataset.exportReady;
      delete document.documentElement.dataset.exportDurationMs;
      delete document.documentElement.dataset.exportError;
      document.body.classList.remove("export-mode");
    };
  }, [exportJobId, project, stage.update, targetCount]);
  const videoExport = useVideoExport({
    scoreFile,
    midiFile,
    audioFile,
    backgroundFiles,
    settings: currentProjectSettings,
    beforeStart: transport.rewind,
    saveToAssetFolder: saveVideoToAssetFolder,
  });

  const togglePlayback = async () => {
    try {
      await transport.toggle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audio playback was blocked / 浏览器阻止了音频播放");
    }
  };

  const totalFrames = project ? videoExportFrameCount(project.midi.durationMs) : 0;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>Melody Rain</h1>
          <p className="subtitle">Let music fall into your life again. / 让音乐，再次落进生活。</p>
        </div>
        <div className="hero-meta">
          <StatusPill message={error ?? status} isError={Boolean(error)} />
        </div>
      </header>

      <section className="workspace-grid">
        <ControlPanel
          project={project}
          folderName={folderName}
          remembersFolders={remembersFolders}
          scoreFile={scoreFile}
          midiFile={midiFile}
          audioFile={audioFile}
          backgroundFiles={backgroundFiles}
          settingsFile={settingsFile}
          folderInputRef={folderInputRef}
          onChooseFolder={() => void chooseAndLoadAssetFolder()}
          onSelectFolder={selectAssetFolder}
          onReadParameters={readProjectSettings}
          onSaveParameters={() => void saveProjectSettings(currentProjectSettings)}
          customTitle={customTitle}
          onCustomTitleChange={setCustomTitle}
          titleColor={titleColor}
          titleColorMode={titleColorMode}
          onTitleColorChange={(color) => {
            setTitleColor(color);
            setTitleColorMode("custom");
          }}
          onUseAutoTitleColor={() => setTitleColorMode("auto")}
          measuresPerSystem={measuresPerSystem}
          onMeasuresPerSystemChange={setMeasuresPerSystem}
          backgroundMode={backgroundMode}
          onBackgroundModeChange={setBackgroundMode}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          selectedBackgroundIndex={selectedBackgroundIndex}
          onSelectedBackgroundIndexChange={setSelectedBackgroundIndex}
          maskBlackMixPercent={maskBlackMixPercent}
          onMaskBlackMixPercentChange={setMaskBlackMixPercent}
          paperTransparencyPercent={paperTransparencyPercent}
          onPaperTransparencyPercentChange={setPaperTransparencyPercent}
          performanceMixPercent={performanceMixPercent}
          onPerformanceMixPercentChange={setPerformanceMixPercent}
          connectedNoteMode={connectedNoteMode}
          onConnectedNoteModeChange={setConnectedNoteMode}
          performanceColorRanges={performanceColorRanges}
          totalFrames={totalFrames}
          onPerformanceColorRangesChange={setPerformanceColorRanges}
        />
        <PlaybackPanel
          project={project}
          exportTitle={customTitle.trim() || project?.score.title || project?.label}
          snapshot={snapshot}
          activeNotes={activeNotes}
          targetCount={targetCount}
          totalFrames={totalFrames}
          audioRef={audioRef}
          stateLabel={stateLabel(snapshot.state)}
          onTogglePlayback={() => void togglePlayback()}
          onRewind={transport.rewind}
          onSeek={transport.seek}
          onTempoScaleChange={transport.setTempoScale}
          exportPhase={videoExport.phase}
          exportActive={videoExport.active}
          exportProgress={videoExport.progress}
          exportError={videoExport.error}
          onStartExport={(fileName, quality, frameRange) => void videoExport.start(fileName, quality, frameRange)}
          onCancelExport={videoExport.cancel}
        />
        <StagePanel
          title={customTitle.trim() || project?.label || "Waiting for media / 等待素材"}
          titleColor={titleColor}
          scoreViewportRef={scoreViewportRef}
          scoreContentClipRef={scoreContentClipRef}
          scoreHostRef={scoreHostRef}
        />
      </section>
    </main>
  );
}
