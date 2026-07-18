import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlPanel, type BackgroundMode } from "./components/control-panel";
import { PlaybackPanel } from "./components/playback-panel";
import { StagePanel } from "./components/stage-panel";
import { useProjectLoader, type LoadedProject } from "./hooks/use-project-loader";
import { MidiTimeline } from "./lib/midi";
import {
  PerformanceEffectLayer,
  mergePerformanceVisuals,
  type PerformanceEffectConfig,
  type PerformanceEffectMode,
} from "./lib/performance-effect-layer";
import { RainLayer } from "./lib/rain-layer";
import { PORTRAIT_RENDER_PROFILE } from "./lib/render-profile";
import { ScoreCamera } from "./lib/score-camera";
import { ScoreMaskLayer, type ScoreMaskSource } from "./lib/score-mask-layer";
import { ScoreRenderer } from "./lib/score-renderer";
import { ScoreTimelineLayer } from "./lib/score-timeline-layer";
import { MediaTransport, TRANSPORT_PRE_ROLL_MS, type TransportSnapshot } from "./lib/transport";

const EMPTY_SNAPSHOT: TransportSnapshot = {
  state: "idle",
  presentationTimeMs: -TRANSPORT_PRE_ROLL_MS - 1,
  sourceTimeMs: -TRANSPORT_PRE_ROLL_MS - 1,
  durationMs: 0,
  scoreQuarter: 0,
  tempoScale: 1,
  effectiveBpm: 120,
  progress: 0,
  activeNoteIds: [],
};

const PLAYING_UI_REFRESH_INTERVAL_MS = 50;

function stateLabel(state: TransportSnapshot["state"]): string {
  return { idle: "待播放", playing: "播放中", paused: "已暂停", ended: "已结束" }[state];
}

export default function App() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [targetCount, setTargetCount] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [measuresPerSystem, setMeasuresPerSystem] = useState(PORTRAIT_RENDER_PROFILE.measuresPerSystem);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("color");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [maskBlackMixPercent, setMaskBlackMixPercent] = useState(10);
  const [paperTransparencyPercent, setPaperTransparencyPercent] = useState(0);
  const [performanceEffectMode, setPerformanceEffectMode] = useState<PerformanceEffectMode>("mask");
  const [performanceMixColor, setPerformanceMixColor] = useState("#1CAEE8");
  const [performanceMixPercent, setPerformanceMixPercent] = useState(35);
  const [selectedBackgroundIndex, setSelectedBackgroundIndex] = useState(0);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const scoreHostRef = useRef<HTMLDivElement>(null);
  const scoreViewportRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transportRef = useRef<MediaTransport | null>(null);
  const rainLayerRef = useRef<RainLayer | null>(null);
  const scoreTimelineLayerRef = useRef<ScoreTimelineLayer | null>(null);
  const scoreCameraRef = useRef<ScoreCamera | null>(null);
  const scoreMaskLayerRef = useRef<ScoreMaskLayer | null>(null);
  const performanceEffectLayerRef = useRef<PerformanceEffectLayer | null>(null);

  const handleProjectLoaded = useCallback((nextProject: LoadedProject) => {
    setCustomTitle("");
    setSelectedBackgroundIndex(0);
    setBackgroundMode(nextProject.backgrounds.length > 0 ? "image" : "color");
    setSnapshot(EMPTY_SNAPSHOT);
  }, []);
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
    folderName,
    folderInputRef,
    remembersFolders,
    selectAssetFolder,
    chooseAndLoadAssetFolder,
  } = useProjectLoader({ onProjectLoaded: handleProjectLoaded });

  const selectedBackgroundFile = project?.backgrounds[selectedBackgroundIndex] ?? null;
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
  const maskSourceRef = useRef<ScoreMaskSource>(maskSource);
  maskSourceRef.current = maskSource;
  const maskBlackMixPercentRef = useRef(maskBlackMixPercent);
  maskBlackMixPercentRef.current = maskBlackMixPercent;
  const paperTransparencyPercentRef = useRef(paperTransparencyPercent);
  paperTransparencyPercentRef.current = paperTransparencyPercent;
  const performanceEffectConfig = useMemo<PerformanceEffectConfig>(() => ({
    mode: performanceEffectMode,
    mixColor: performanceMixColor,
    mixAmount: performanceMixPercent / 100,
  }), [performanceEffectMode, performanceMixColor, performanceMixPercent]);
  const performanceEffectConfigRef = useRef(performanceEffectConfig);
  performanceEffectConfigRef.current = performanceEffectConfig;

  useEffect(() => {
    const host = scoreHostRef.current;
    if (!host || !project) return;
    let cancelled = false;
    const disposeLayers = () => {
      const layers = [
        rainLayerRef.current,
        scoreTimelineLayerRef.current,
        scoreCameraRef.current,
        scoreMaskLayerRef.current,
        performanceEffectLayerRef.current,
      ];
      layers.forEach((layer) => layer?.dispose());
      rainLayerRef.current = null;
      scoreTimelineLayerRef.current = null;
      scoreCameraRef.current = null;
      scoreMaskLayerRef.current = null;
      performanceEffectLayerRef.current = null;
    };
    disposeLayers();
    const renderHost = document.createElement("div");
    renderHost.className = "score-render-content";
    host.replaceChildren(renderHost);
    setTargetCount(0);
    setStatus("正在排版 SVG 五线谱…");
    const renderer = new ScoreRenderer(renderHost);
    void renderer
      .render(project.musicXml, measuresPerSystem, PORTRAIT_RENDER_PROFILE.scoreScale)
      .then(({ targets, restSymbols, revealElements, growingSpans, maskElements }) => {
        if (cancelled) return;
        const timeline = new MidiTimeline(project.midi);
        const rainLayer = new RainLayer(host, timeline);
        rainLayer.setEvents(project.midi.events, targets, restSymbols);
        const currentTimeMs = transportRef.current?.snapshot().sourceTimeMs ?? -TRANSPORT_PRE_ROLL_MS - 1;
        rainLayer.update(currentTimeMs);
        rainLayerRef.current = rainLayer;
        const scoreTimelineLayer = new ScoreTimelineLayer(timeline);
        scoreTimelineLayer.setElements(revealElements, growingSpans);
        scoreTimelineLayer.update(currentTimeMs);
        scoreTimelineLayerRef.current = scoreTimelineLayer;
        const viewport = scoreViewportRef.current;
        if (viewport) {
          const performanceEffectLayer = new PerformanceEffectLayer(viewport, viewport);
          performanceEffectLayer.setVisuals(mergePerformanceVisuals(
            rainLayer.performanceVisuals(),
            scoreTimelineLayer.performanceVisuals(),
          ));
          performanceEffectLayer.setSource(maskSourceRef.current);
          performanceEffectLayer.setConfig(performanceEffectConfigRef.current);
          performanceEffectLayer.update();
          performanceEffectLayerRef.current = performanceEffectLayer;
          const scoreMaskLayer = new ScoreMaskLayer(viewport, host);
          scoreMaskLayer.setElements(maskElements);
          scoreMaskLayer.setSource(maskSourceRef.current);
          scoreMaskLayer.setBlackMix(maskBlackMixPercentRef.current / 100);
          scoreMaskLayer.setPaperTransparency(paperTransparencyPercentRef.current / 100);
          scoreMaskLayerRef.current = scoreMaskLayer;
          const scoreCamera = new ScoreCamera(viewport, host);
          scoreCamera.setAnchors([
            ...targets.map((target) => ({ scoreQuarter: target.scoreQuarter, x: target.x, y: target.y })),
            ...restSymbols.map((rest) => ({ scoreQuarter: rest.scoreQuarter, x: rest.x, y: rest.y })),
          ]);
          scoreCamera.update(timeline.scoreQuarterAt(currentTimeMs));
          scoreCameraRef.current = scoreCamera;
        }
        setTargetCount(targets.length);
        setStatus("谱面、MIDI 与音频已就绪");
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
      disposeLayers();
      renderHost.remove();
    };
  }, [project, measuresPerSystem]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setSource(maskSource);
    performanceEffectLayerRef.current?.setSource(maskSource);
  }, [maskSource]);

  useEffect(() => {
    performanceEffectLayerRef.current?.setConfig(performanceEffectConfig);
  }, [performanceEffectConfig]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setBlackMix(maskBlackMixPercent / 100);
  }, [maskBlackMixPercent]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setPaperTransparency(paperTransparencyPercent / 100);
  }, [paperTransparencyPercent]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !project) return;
    transportRef.current?.dispose();
    audio.src = project.audioUrl;
    audio.load();
    const transport = new MediaTransport(audio, new MidiTimeline(project.midi));
    transportRef.current = transport;
    let lastPublishedAt = Number.NEGATIVE_INFINITY;
    let lastPublishedState: TransportSnapshot["state"] | null = null;
    let lastPublishedTempoScale = 0;
    const unsubscribe = transport.subscribe((nextSnapshot) => {
      rainLayerRef.current?.update(nextSnapshot.sourceTimeMs);
      scoreTimelineLayerRef.current?.update(nextSnapshot.sourceTimeMs);
      scoreCameraRef.current?.update(nextSnapshot.scoreQuarter);
      performanceEffectLayerRef.current?.update();

      const now = performance.now();
      const transportControlsChanged = nextSnapshot.state !== lastPublishedState
        || nextSnapshot.tempoScale !== lastPublishedTempoScale;
      if (
        nextSnapshot.state !== "playing"
        || transportControlsChanged
        || now - lastPublishedAt >= PLAYING_UI_REFRESH_INTERVAL_MS
      ) {
        lastPublishedAt = now;
        lastPublishedState = nextSnapshot.state;
        lastPublishedTempoScale = nextSnapshot.tempoScale;
        setSnapshot(nextSnapshot);
      }
    });
    return () => {
      unsubscribe();
      transport.dispose();
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, [project]);

  const midiEventsById = useMemo(
    () => new Map(project?.midi.events.map((event) => [event.id, event]) ?? []),
    [project],
  );
  const activeNotes = useMemo(() => snapshot.activeNoteIds.flatMap((id) => {
    const event = midiEventsById.get(id);
    return event ? [event] : [];
  }), [midiEventsById, snapshot.activeNoteIds]);

  const togglePlayback = async () => {
    try {
      await transportRef.current?.toggle();
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
          folderInputRef={folderInputRef}
          onChooseFolder={() => void chooseAndLoadAssetFolder()}
          onSelectFolder={selectAssetFolder}
          customTitle={customTitle}
          onCustomTitleChange={setCustomTitle}
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
        />
        <PlaybackPanel
          project={project}
          snapshot={snapshot}
          activeNotes={activeNotes}
          targetCount={targetCount}
          audioRef={audioRef}
          stateLabel={stateLabel(snapshot.state)}
          onTogglePlayback={() => void togglePlayback()}
          onRewind={() => transportRef.current?.rewind()}
          onSeek={(progress) => transportRef.current?.seek(progress)}
          onTempoScaleChange={(scale) => transportRef.current?.setTempoScale(scale)}
        />
        <StagePanel
          title={customTitle.trim() || project?.label || "等待素材"}
          scoreViewportRef={scoreViewportRef}
          scoreHostRef={scoreHostRef}
        />
      </section>
    </main>
  );
}
