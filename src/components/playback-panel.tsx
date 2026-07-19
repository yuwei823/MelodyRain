import type { RefObject } from "react";
import { formatDuration } from "../lib/format";
import type { MidiNoteEvent } from "../lib/midi";
import type { TransportSnapshot } from "../lib/transport";
import type { LoadedProject } from "../hooks/use-project-loader";
import { ExportCard } from "./export-card";
import type { VideoExportPhase } from "../hooks/use-video-export";
import {
  videoExportCurrentFrame,
  videoExportFrameCount,
  type VideoExportFrameRange,
  type VideoExportQuality,
} from "../lib/video-export";

interface PlaybackPanelProps {
  project: LoadedProject | null;
  exportTitle?: string;
  snapshot: TransportSnapshot;
  activeNotes: MidiNoteEvent[];
  targetCount: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  stateLabel: string;
  onTogglePlayback(): void;
  onRewind(): void;
  onSeek(progress: number): void;
  onTempoScaleChange(scale: number): void;
  exportPhase: VideoExportPhase;
  exportProgress: number;
  exportError: string | null;
  onStartExport(fileName: string, quality: VideoExportQuality, frameRange: VideoExportFrameRange): void;
  onCancelExport(): void;
}

export function PlaybackPanel({
  project,
  exportTitle,
  snapshot,
  activeNotes,
  targetCount,
  audioRef,
  stateLabel,
  onTogglePlayback,
  onRewind,
  onSeek,
  onTempoScaleChange,
  exportPhase,
  exportProgress,
  exportError,
  onStartExport,
  onCancelExport,
}: PlaybackPanelProps) {
  const exportDurationMs = project?.midi.durationMs ?? 0;
  const totalFrames = project ? videoExportFrameCount(exportDurationMs) : 0;
  const currentFrame = videoExportCurrentFrame(snapshot.sourceTimeMs, totalFrames);
  return (
    <aside className="app-panel playback-panel">
      <div className="ui-card ui-stack sidebar-transport" aria-label="Playback controls / 播放控制">
        <audio ref={audioRef} aria-label="Score audio / 乐谱音频" />
        <div className="sidebar-transport-heading">
          <p className="step-label">PREVIEW / 预览</p>
          <span>{stateLabel}</span>
        </div>
        <div className="playback-buttons">
          <button className="ui-button ui-button--round round-button" type="button" onClick={onRewind} aria-label="Rewind / 回到开头">↺</button>
          <button className="ui-button ui-button--primary play-button" type="button" onClick={onTogglePlayback}>
            {snapshot.state === "playing" ? "Pause / 暂停" : "Play / 播放"}
          </button>
        </div>
        <div className="timeline-control">
          <input
            aria-label="Playback progress / 播放进度"
            type="range"
            min="0"
            max="1"
            step="0.0001"
            value={snapshot.progress}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <div className="time-row">
            <span>{formatDuration(snapshot.sourceTimeMs)}</span>
            <span>{formatDuration(snapshot.durationMs || project?.midi.durationMs || 0)}</span>
          </div>
        </div>

        <div className="speed-group" aria-label="Playback speed / 播放速度">
          <span className="speed-label">Playback speed / 播放速度</span>
          {[0.9, 0.95, 1].map((speed) => (
            <button
              type="button"
              className={`ui-button ui-button--ghost ui-button--compact ${snapshot.tempoScale === speed ? "is-active" : ""}`}
              key={speed}
              onClick={() => onTempoScaleChange(speed)}
            >
              {speed}×
            </button>
          ))}
        </div>
        <div className="transport-stats">
          <span>{snapshot.effectiveBpm.toFixed(0)} BPM</span>
          <span>♩ {snapshot.scoreQuarter.toFixed(2)}</span>
          <span>Frame / 当前帧 {project ? `${currentFrame + 1} / ${totalFrames}` : "—"}</span>
        </div>
        <div className="sidebar-active-notes" aria-live="polite">
          <span className="active-label">Active MIDI notes / 当前 MIDI 音符</span>
          <div className="note-list">
            {activeNotes.length === 0 ? <span className="empty-note">—</span> : activeNotes.map((note) => (
              <span className="note-chip" key={note.id}>{note.name}<small>{Math.round(note.velocity * 127)}</small></span>
            ))}
          </div>
        </div>
      </div>

      <ExportCard
        projectLabel={exportTitle}
        durationMs={exportDurationMs}
        phase={exportPhase}
        progress={exportProgress}
        error={exportError}
        onStart={onStartExport}
        onCancel={onCancelExport}
      />

      {project && (
        <div className="ui-card facts">
          <div><span>Score / 乐谱</span><strong>{project.score.title}</strong></div>
          <div><span>Instruments / 乐器</span><strong>{project.score.partNames.join(" · ") || "—"}</strong></div>
          <div><span>Measures / 小节</span><strong>{project.score.measureCount}</strong></div>
          <div><span>MIDI notes / MIDI 音符</span><strong>{project.midi.noteCount}</strong></div>
          <div><span>Tempo events / 速度事件</span><strong>{project.midi.tempoMap.length}</strong></div>
          <div><span>SVG targets / SVG 落点</span><strong>{targetCount}</strong></div>
        </div>
      )}
    </aside>
  );
}
