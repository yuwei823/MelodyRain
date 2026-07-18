import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "./lib/format";
import {
  assetRelativePath,
  matchProjectFolderAssets,
  type MatchedProjectAssets,
} from "./lib/asset-folder";
import {
  canReadFolder,
  canRememberFolder,
  chooseAssetFolder,
  filesInFolder,
  lastRememberedAssetFolder,
  rememberAssetFolder,
} from "./lib/remembered-folder";
import { MidiTimeline, parseMidi, type MidiSummary } from "./lib/midi";
import { extractMusicXml, summarizeMusicXml, type ScoreSummary } from "./lib/mxl";
import { RainLayer } from "./lib/rain-layer";
import { PORTRAIT_ASPECT_RATIO, PORTRAIT_RENDER_PROFILE } from "./lib/render-profile";
import { ScoreRenderer } from "./lib/score-renderer";
import { ScoreCamera } from "./lib/score-camera";
import { ScoreMaskLayer, type ScoreMaskSource } from "./lib/score-mask-layer";
import { ScoreTimelineLayer } from "./lib/score-timeline-layer";
import { MediaTransport, TRANSPORT_PRE_ROLL_MS, type TransportSnapshot } from "./lib/transport";

interface LoadedProject {
  label: string;
  musicXml: string;
  score: ScoreSummary;
  midi: MidiSummary;
  audioUrl: string;
  backgrounds: File[];
  revokeAudioUrl?: boolean;
}

type BackgroundMode = "image" | "color";

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

async function readScoreFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".mxl") ? extractMusicXml(await file.arrayBuffer()) : file.text();
}

function stateLabel(state: TransportSnapshot["state"]): string {
  return { idle: "待播放", playing: "播放中", paused: "已暂停", ended: "已结束" }[state];
}

export default function App() {
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState("请选择素材文件夹");
  const [error, setError] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState(0);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundFiles, setBackgroundFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [measuresPerSystem, setMeasuresPerSystem] = useState(PORTRAIT_RENDER_PROFILE.measuresPerSystem);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("color");
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [maskBlackMixPercent, setMaskBlackMixPercent] = useState(0);
  const [paperTransparencyPercent, setPaperTransparencyPercent] = useState(0);
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
  const folderInputRef = useRef<HTMLInputElement>(null);

  const adoptProject = useCallback((nextProject: LoadedProject) => {
    setProject((previous) => {
      if (previous?.revokeAudioUrl) URL.revokeObjectURL(previous.audioUrl);
      return nextProject;
    });
    setCustomTitle("");
    setSelectedBackgroundIndex(0);
    setBackgroundMode(nextProject.backgrounds.length > 0 ? "image" : "color");
    setSnapshot(EMPTY_SNAPSHOT);
    setError(null);
  }, []);

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

  useEffect(() => {
    const host = scoreHostRef.current;
    if (!host || !project) return;
    let cancelled = false;
    rainLayerRef.current?.dispose();
    rainLayerRef.current = null;
    scoreTimelineLayerRef.current?.dispose();
    scoreTimelineLayerRef.current = null;
    scoreCameraRef.current?.dispose();
    scoreCameraRef.current = null;
    scoreMaskLayerRef.current?.dispose();
    scoreMaskLayerRef.current = null;
    host.replaceChildren();
    setTargetCount(0);
    setStatus("正在排版 SVG 五线谱…");
    const renderer = new ScoreRenderer(host);
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
        // Tie curves are growing spans; their continuation noteheads stay in
        // the rain layer, avoiding two layers competing to hide the same SVG.
        scoreTimelineLayer.setElements(revealElements, growingSpans);
        scoreTimelineLayer.update(currentTimeMs);
        scoreTimelineLayerRef.current = scoreTimelineLayer;
        const viewport = scoreViewportRef.current;
        if (viewport) {
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
      rainLayerRef.current?.dispose();
      rainLayerRef.current = null;
      scoreTimelineLayerRef.current?.dispose();
      scoreTimelineLayerRef.current = null;
      scoreCameraRef.current?.dispose();
      scoreCameraRef.current = null;
      scoreMaskLayerRef.current?.dispose();
      scoreMaskLayerRef.current = null;
    };
  }, [project, measuresPerSystem]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setSource(maskSource);
  }, [maskSource]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setBlackMix(maskBlackMixPercent / 100);
  }, [maskBlackMixPercent]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setPaperTransparency(paperTransparencyPercent / 100);
  }, [paperTransparencyPercent]);

  useEffect(() => {
    rainLayerRef.current?.update(snapshot.sourceTimeMs);
    scoreTimelineLayerRef.current?.update(snapshot.sourceTimeMs);
    scoreCameraRef.current?.update(snapshot.scoreQuarter);
  }, [snapshot.scoreQuarter, snapshot.sourceTimeMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !project) return;
    transportRef.current?.dispose();
    audio.src = project.audioUrl;
    audio.load();
    const transport = new MediaTransport(audio, new MidiTimeline(project.midi));
    transportRef.current = transport;
    const unsubscribe = transport.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      transport.dispose();
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, [project]);

  useEffect(
    () => () => {
      if (project?.revokeAudioUrl) URL.revokeObjectURL(project.audioUrl);
    },
    [project],
  );

  const activeNotes = useMemo(() => {
    if (!project) return [];
    const active = new Set(snapshot.activeNoteIds);
    return project.midi.events.filter((event) => active.has(event.id));
  }, [project, snapshot.activeNoteIds]);

  const loadRememberedFolder = async () => {
    try {
      const handle = await lastRememberedAssetFolder();
      if (!handle) return;
      setFolderName(handle.name);
      if (!await canReadFolder(handle)) {
        setStatus(`已记住“${handle.name}”，请重新选择以授权读取。`);
        return;
      }
      setStatus(`正在重新读取“${handle.name}”…`);
      selectAssetFolderFromFiles(await filesInFolder(handle));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  useEffect(() => {
    if (canRememberFolder()) void loadRememberedFolder();
  }, []);

  const selectAssetFolderFromFiles = (files: File[]) => {
    setScoreFile(null);
    setMidiFile(null);
    setAudioFile(null);
    setBackgroundFiles([]);
    if (files.length === 0) {
      setStatus("尚未选择素材文件夹");
      return;
    }
    try {
      const matched = matchProjectFolderAssets(files);
      setScoreFile(matched.score);
      setMidiFile(matched.midi);
      setAudioFile(matched.audio);
      setBackgroundFiles(matched.backgrounds);
      setError(null);
      void loadLocalFiles(matched);
    } catch (caught) {
      setStatus("素材匹配失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const selectAssetFolder = (files: FileList | null) => {
    setFolderName(files?.[0]?.webkitRelativePath.split("/")[0] ?? null);
    selectAssetFolderFromFiles(files ? [...files] : []);
  };

  const chooseAndLoadAssetFolder = async () => {
    if (!canRememberFolder()) {
      folderInputRef.current?.click();
      return;
    }
    try {
      const handle = await chooseAssetFolder();
      await rememberAssetFolder(handle);
      setFolderName(handle.name);
      selectAssetFolderFromFiles(await filesInFolder(handle));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const loadLocalFiles = async (matchedAssets?: MatchedProjectAssets<File>) => {
    const assets = matchedAssets ?? (scoreFile && midiFile && audioFile
      ? { score: scoreFile, midi: midiFile, audio: audioFile, backgrounds: backgroundFiles }
      : null);
    if (!assets) {
      setError("请选择包含 MXL/MusicXML、MIDI 和 MP3 的素材文件夹");
      return;
    }
    setStatus("正在解析本地文件…");
    setError(null);
    try {
      const [musicXml, midiBuffer] = await Promise.all([readScoreFile(assets.score), assets.midi.arrayBuffer()]);
      adoptProject({
        label: assets.score.name,
        musicXml,
        score: summarizeMusicXml(musicXml),
        midi: parseMidi(midiBuffer),
        audioUrl: URL.createObjectURL(assets.audio),
        backgrounds: assets.backgrounds,
        revokeAudioUrl: true,
      });
      setStatus("本地文件已加载");
    } catch (caught) {
      setStatus("解析失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

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
        <aside className="control-panel">
          <div className="folder-picker">
            <span>素材文件夹</span>
            <button className="folder-select-button" type="button" onClick={() => void chooseAndLoadAssetFolder()}>
              {folderName ? `更换文件夹：${folderName}` : "选择素材文件夹"}
            </button>
            <input
              className="folder-input-fallback"
              type="file"
              multiple
              ref={(input) => {
                folderInputRef.current = input;
                input?.setAttribute("webkitdirectory", "");
                input?.setAttribute("directory", "");
              }}
              onChange={(event) => selectAssetFolder(event.target.files)}
              aria-label="选择素材文件夹"
            />
            <p>{canRememberFolder()
              ? "将记住此文件夹，并在刷新后自动重新读取乐谱、MIDI、MP3 和背景图片。"
              : "自动匹配同名的 MXL/MusicXML、MIDI 和 MP3，并读取背景图片。"}</p>
            {(scoreFile || midiFile || audioFile || backgroundFiles.length > 0) && (
              <div className="matched-assets">
                <div><span>乐谱</span><strong>{scoreFile ? assetRelativePath(scoreFile) : "缺失"}</strong></div>
                <div><span>MIDI</span><strong>{midiFile ? assetRelativePath(midiFile) : "缺失"}</strong></div>
                <div><span>MP3</span><strong>{audioFile ? assetRelativePath(audioFile) : "缺失"}</strong></div>
                <div>
                  <span>背景</span>
                  <strong>{backgroundFiles.length > 0 ? `${backgroundFiles.length} 张图片` : "纯色 #000000"}</strong>
                </div>
              </div>
            )}
          </div>
          <div className="layout-control">
            <div className="layout-control-heading">
              <div>
                <p className="step-label">LAYOUT</p>
                <strong>每行小节数</strong>
              </div>
              <output>{measuresPerSystem}</output>
            </div>
            <input
              aria-label="每行小节数"
              type="range"
              min="1"
              max="6"
              step="1"
              value={measuresPerSystem}
              onChange={(event) => setMeasuresPerSystem(Number(event.target.value))}
            />
            <p>乐谱按原尺寸的 2/3 显示，竖屏默认每行 2 个小节；首行自然排版，后续各行与首行栏线对齐。</p>
          </div>

          <div className="background-control">
            <div>
              <p className="step-label">MASK SOURCE</p>
              <strong>谱面蒙版背景</strong>
            </div>
            <div className="background-mode" aria-label="蒙版背景模式">
              <button
                type="button"
                aria-pressed={backgroundMode === "image"}
                disabled={!project?.backgrounds.length}
                onClick={() => setBackgroundMode("image")}
              >
                图片
              </button>
              <button
                type="button"
                aria-pressed={backgroundMode === "color"}
                onClick={() => setBackgroundMode("color")}
              >
                纯色
              </button>
            </div>
            {backgroundMode === "image" && project?.backgrounds.length ? (
              <label>
                <span>背景图片</span>
                <select
                  value={selectedBackgroundIndex}
                  onChange={(event) => setSelectedBackgroundIndex(Number(event.target.value))}
                >
                  {project.backgrounds.map((background, index) => (
                    <option value={index} key={assetRelativePath(background)}>
                      {assetRelativePath(background)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="color-control">
                <span>背景颜色</span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  aria-label="蒙版背景颜色"
                />
                <output>{backgroundColor.toUpperCase()}</output>
              </label>
            )}
            <label className="black-mix-control">
              <span>黑色混入</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={maskBlackMixPercent}
                onChange={(event) => setMaskBlackMixPercent(Number(event.target.value))}
                aria-label="蒙版黑色混入比例"
              />
              <output>{maskBlackMixPercent}%</output>
            </label>
            <label className="paper-transparency-control">
              <span>谱纸透明度</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={paperTransparencyPercent}
                onChange={(event) => setPaperTransparencyPercent(Number(event.target.value))}
                aria-label="浅色谱纸透明度"
              />
              <output>{paperTransparencyPercent}%</output>
            </label>
            <small>图片固定在画面中并居中裁切，以最短边撑满谱面视口。</small>
          </div>

          <label className="title-control">
            <span className="step-label">TITLE</span>
            <strong>画面标题</strong>
            <input
              type="text"
              value={customTitle}
              placeholder={project?.label ?? "等待素材"}
              onChange={(event) => setCustomTitle(event.target.value)}
              aria-label="画面标题"
            />
            <small>留空时使用素材原名称。</small>
          </label>

          <div className="sidebar-transport" aria-label="播放控制">
            <audio ref={audioRef} aria-label="乐谱音频" />
            <div className="sidebar-transport-heading">
              <p className="step-label">PLAYBACK</p>
              <span>{stateLabel(snapshot.state)}</span>
            </div>
            <div className="playback-buttons">
              <button className="round-button" type="button" onClick={() => transportRef.current?.rewind()} aria-label="回到开头">↺</button>
              <button className="play-button" type="button" onClick={() => void togglePlayback()}>
                {snapshot.state === "playing" ? "暂停" : "播放"}
              </button>
            </div>
            <div className="timeline-control">
              <input
                aria-label="播放进度"
                type="range"
                min="0"
                max="1"
                step="0.0001"
                value={snapshot.progress}
                onChange={(event) => transportRef.current?.seek(Number(event.target.value))}
              />
              <div className="time-row">
                <span>{formatDuration(snapshot.sourceTimeMs)}</span>
                <span>{formatDuration(snapshot.durationMs || project?.midi.durationMs || 0)}</span>
              </div>
            </div>
            <div className="speed-group" aria-label="播放速度">
              {[0.5, 0.75, 1].map((speed) => (
                <button
                  type="button"
                  className={snapshot.tempoScale === speed ? "is-active" : ""}
                  key={speed}
                  onClick={() => transportRef.current?.setTempoScale(speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <div className="sidebar-active-notes" aria-live="polite">
              <span className="active-label">当前 MIDI 音符</span>
              <div className="note-list">
                {activeNotes.length === 0 ? <span className="empty-note">—</span> : activeNotes.map((note) => (
                  <span className="note-chip" key={note.id}>{note.name}<small>{Math.round(note.velocity * 127)}</small></span>
                ))}
              </div>
            </div>
          </div>

          {project && (
            <div className="facts">
              <div><span>乐谱</span><strong>{project.score.title}</strong></div>
              <div><span>乐器</span><strong>{project.score.partNames.join(" · ") || "—"}</strong></div>
              <div><span>小节</span><strong>{project.score.measureCount}</strong></div>
              <div><span>MIDI 音符</span><strong>{project.midi.noteCount}</strong></div>
              <div><span>Tempo events</span><strong>{project.midi.tempoMap.length}</strong></div>
              <div><span>SVG 落点</span><strong>{targetCount}</strong></div>
            </div>
          )}
        </aside>

        <section className="stage-panel">
          <div className="stage-preview-wrap">
            <div
              className="portrait-frame"
              style={{ aspectRatio: PORTRAIT_ASPECT_RATIO }}
              data-render-profile={PORTRAIT_RENDER_PROFILE.id}
              aria-label="1080 × 1920 竖屏视频预览"
            >
              <div className="stage-toolbar">
                <div>
                  <h2>{customTitle.trim() || project?.label || "等待素材"}</h2>
                </div>
              </div>
              <div ref={scoreViewportRef} className="score-viewport">
                <div ref={scoreHostRef} className="score-host" aria-label="SVG 五线谱预览" />
              </div>
            </div>
            <div className="frame-caption">
              <span>竖屏视频画幅</span>
              <strong>{PORTRAIT_RENDER_PROFILE.width} × {PORTRAIT_RENDER_PROFILE.height}</strong>
              <span>9:16 · {PORTRAIT_RENDER_PROFILE.fps} FPS</span>
            </div>
          </div>

        </section>
      </section>
    </main>
  );
}
