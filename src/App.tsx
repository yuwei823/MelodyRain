import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "./lib/format";
import { MidiTimeline, parseMidi, type MidiSummary } from "./lib/midi";
import { extractMusicXml, summarizeMusicXml, type ScoreSummary } from "./lib/mxl";
import { RainLayer } from "./lib/rain-layer";
import { ScoreRenderer } from "./lib/score-renderer";
import { MediaTransport, type TransportSnapshot } from "./lib/transport";

interface DemoManifest {
  title: string;
  assets: { score: string; midi: string; audio: string };
}

interface LoadedProject {
  label: string;
  musicXml: string;
  score: ScoreSummary;
  midi: MidiSummary;
  audioUrl: string;
  revokeAudioUrl?: boolean;
}

const EMPTY_SNAPSHOT: TransportSnapshot = {
  state: "idle",
  presentationTimeMs: 0,
  sourceTimeMs: 0,
  durationMs: 0,
  scoreQuarter: 0,
  tempoScale: 1,
  effectiveBpm: 120,
  progress: 0,
  activeNoteIds: [],
};

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`资源读取失败：${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

async function readScoreFile(file: File): Promise<string> {
  return file.name.toLowerCase().endsWith(".mxl") ? extractMusicXml(await file.arrayBuffer()) : file.text();
}

function stateLabel(state: TransportSnapshot["state"]): string {
  return { idle: "待播放", playing: "播放中", paused: "已暂停", ended: "已结束" }[state];
}

export default function App() {
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState("正在连接本地服务…");
  const [error, setError] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState(0);
  const [scoreFile, setScoreFile] = useState<File | null>(null);
  const [midiFile, setMidiFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [measuresPerSystem, setMeasuresPerSystem] = useState(4);
  const scoreHostRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transportRef = useRef<MediaTransport | null>(null);
  const rainLayerRef = useRef<RainLayer | null>(null);

  const adoptProject = useCallback((nextProject: LoadedProject) => {
    setProject((previous) => {
      if (previous?.revokeAudioUrl) URL.revokeObjectURL(previous.audioUrl);
      return nextProject;
    });
    setSnapshot(EMPTY_SNAPSHOT);
    setError(null);
  }, []);

  const loadDemo = useCallback(async () => {
    setStatus("正在加载《欢乐颂》示例素材…");
    setError(null);
    try {
      const manifestResponse = await fetch("/api/demo/manifest");
      if (!manifestResponse.ok) throw new Error("本地服务未返回示例清单");
      const manifest = (await manifestResponse.json()) as DemoManifest;
      const [mxlBuffer, midiBuffer] = await Promise.all([
        fetchBuffer(manifest.assets.score),
        fetchBuffer(manifest.assets.midi),
      ]);
      const musicXml = extractMusicXml(mxlBuffer);
      adoptProject({
        label: manifest.title,
        musicXml,
        score: summarizeMusicXml(musicXml),
        midi: parseMidi(midiBuffer),
        audioUrl: manifest.assets.audio,
      });
      setStatus("示例素材已加载");
    } catch (caught) {
      setStatus("加载失败");
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [adoptProject]);

  useEffect(() => {
    void loadDemo();
  }, [loadDemo]);

  useEffect(() => {
    const host = scoreHostRef.current;
    if (!host || !project) return;
    let cancelled = false;
    rainLayerRef.current?.dispose();
    rainLayerRef.current = null;
    host.replaceChildren();
    setTargetCount(0);
    setStatus("正在排版 SVG 五线谱…");
    const renderer = new ScoreRenderer(host);
    void renderer
      .render(project.musicXml, measuresPerSystem)
      .then((targets) => {
        if (cancelled) return;
        const rainLayer = new RainLayer(host);
        rainLayer.setEvents(project.midi.events, targets);
        rainLayer.update(snapshot.sourceTimeMs);
        rainLayerRef.current = rainLayer;
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
    };
  }, [project, measuresPerSystem]);

  useEffect(() => {
    rainLayerRef.current?.update(snapshot.sourceTimeMs);
  }, [snapshot.sourceTimeMs]);

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

  const loadLocalFiles = async () => {
    if (!scoreFile || !midiFile || !audioFile) {
      setError("请选择 MXL/MusicXML、MIDI 和 MP3 三个文件");
      return;
    }
    setStatus("正在解析本地文件…");
    setError(null);
    try {
      const [musicXml, midiBuffer] = await Promise.all([readScoreFile(scoreFile), midiFile.arrayBuffer()]);
      adoptProject({
        label: scoreFile.name,
        musicXml,
        score: summarizeMusicXml(musicXml),
        midi: parseMidi(midiBuffer),
        audioUrl: URL.createObjectURL(audioFile),
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
        <div className={`status-pill ${error ? "is-error" : ""}`}>
          <span className="status-dot" />
          {error ?? status}
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="control-panel">
          <div className="panel-heading">
            <p className="step-label">01 · SOURCE</p>
            <h2>本地素材</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadDemo()}>
            重新加载示例
          </button>
          <div className="file-stack">
            <label>
              <span>MXL / MusicXML</span>
              <input type="file" accept=".mxl,.musicxml,.xml" onChange={(event) => setScoreFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              <span>MIDI</span>
              <input type="file" accept=".mid,.midi,audio/midi" onChange={(event) => setMidiFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              <span>MP3</span>
              <input type="file" accept=".mp3,audio/mpeg" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button className="primary-button" type="button" onClick={() => void loadLocalFiles()}>
            载入所选文件
          </button>

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
            <p>横屏默认每行 4 个小节；首行自然排版，后续各行与首行栏线对齐。</p>
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
          <div className="stage-toolbar">
            <div>
              <p className="step-label">02 · SCORE</p>
              <h2>{project?.label ?? "等待素材"}</h2>
            </div>
            <div className="transport-stats">
              <span>{snapshot.effectiveBpm.toFixed(0)} BPM</span>
              <span>♩ {snapshot.scoreQuarter.toFixed(2)}</span>
              <span>{stateLabel(snapshot.state)}</span>
            </div>
          </div>
          <div className="score-viewport">
            <div ref={scoreHostRef} className="score-host" aria-label="SVG 五线谱预览" />
          </div>

          <div className="transport-panel">
            <audio ref={audioRef} aria-label="乐谱音频" />
            <button className="round-button" type="button" onClick={() => transportRef.current?.rewind()} aria-label="回到开头">↺</button>
            <button className="play-button" type="button" onClick={() => void togglePlayback()}>
              {snapshot.state === "playing" ? "暂停" : "播放"}
            </button>
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
          </div>

          <div className="active-notes" aria-live="polite">
            <span className="active-label">当前 MIDI 音符</span>
            <div className="note-list">
              {activeNotes.length === 0 ? <span className="empty-note">—</span> : activeNotes.map((note) => (
                <span className="note-chip" key={note.id}>{note.name}<small>{Math.round(note.velocity * 127)}</small></span>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
