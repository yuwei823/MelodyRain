import { useCallback, useRef } from "react";
import { ControlPanel } from "./components/control-panel";
import { PlaybackPanel } from "./components/playback-panel";
import { StagePanel } from "./components/stage-panel";
import { useProjectLoader, type LoadedProject } from "./hooks/use-project-loader";
import { useMediaTransport } from "./hooks/use-media-transport";
import { useProjectVisualSettings } from "./hooks/use-project-visual-settings";
import { useScoreStage } from "./hooks/use-score-stage";
import type { TransportSnapshot } from "./lib/transport";

function stateLabel(state: TransportSnapshot["state"]): string {
  return { idle: "待播放", playing: "播放中", paused: "已暂停", ended: "已结束" }[state];
}

export default function App() {
  const visual = useProjectVisualSettings();

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
    connectedNoteMode: visual.connectedNoteMode,
    currentSourceTimeMs: transport.currentSourceTimeMs, setStatus, setError });
  stageUpdateRef.current = stage.update;
  const {
    customTitle, setCustomTitle, titleColor, setTitleColor, titleColorMode, setTitleColorMode,
    measuresPerSystem, setMeasuresPerSystem, backgroundMode, setBackgroundMode, backgroundColor,
    setBackgroundColor, maskBlackMixPercent, setMaskBlackMixPercent, paperTransparencyPercent,
    setPaperTransparencyPercent, performanceEffectMode, setPerformanceEffectMode, performanceMixColor,
    setPerformanceMixColor, performanceMixPercent, setPerformanceMixPercent, selectedBackgroundIndex,
    setSelectedBackgroundIndex, currentProjectSettings,
    connectedNoteMode, setConnectedNoteMode,
  } = visual;
  const { snapshot, activeNotes, audioRef } = transport;
  const { targetCount, scoreHostRef, scoreViewportRef, scoreContentClipRef } = stage;

  const togglePlayback = async () => {
    try {
      await transport.toggle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "浏览器阻止了音频播放");
    }
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>Melody Rain</h1>
          <p className="subtitle">MusicXML 乐谱、MIDI 时间轴与音乐，由同一个 Transport 驱动。</p>
        </div>
        <div className="hero-meta">
          <div className={`status-pill ${error ? "is-error" : ""}`}>
            <span className="status-dot" />
            {error ?? status}
          </div>
          <div className="transport-stats">
            <span>{snapshot.effectiveBpm.toFixed(0)} BPM</span>
            <span>♩ {snapshot.scoreQuarter.toFixed(2)}</span>
            <span>{stateLabel(snapshot.state)}</span>
          </div>
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
            setTitleColor(color.toUpperCase());
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
          performanceEffectMode={performanceEffectMode}
          onPerformanceEffectModeChange={setPerformanceEffectMode}
          performanceMixColor={performanceMixColor}
          onPerformanceMixColorChange={setPerformanceMixColor}
          performanceMixPercent={performanceMixPercent}
          onPerformanceMixPercentChange={setPerformanceMixPercent}
          connectedNoteMode={connectedNoteMode}
          onConnectedNoteModeChange={setConnectedNoteMode}
        />
        <PlaybackPanel
          project={project}
          snapshot={snapshot}
          activeNotes={activeNotes}
          targetCount={targetCount}
          audioRef={audioRef}
          stateLabel={stateLabel(snapshot.state)}
          onTogglePlayback={() => void togglePlayback()}
          onRewind={transport.rewind}
          onSeek={transport.seek}
          onTempoScaleChange={transport.setTempoScale}
        />
        <StagePanel
          title={customTitle.trim() || project?.label || "等待素材"}
          titleColor={titleColor}
          scoreViewportRef={scoreViewportRef}
          scoreContentClipRef={scoreContentClipRef}
          scoreHostRef={scoreHostRef}
        />
      </section>
    </main>
  );
}
