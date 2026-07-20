import type { RefObject } from "react";
import { formatDuration } from "../lib/format";
import type { MidiNoteEvent } from "../lib/midi";
import type { TransportSnapshot } from "../lib/transport";
import type { LoadedProject } from "../hooks/use-project-loader";
import { ExportCard } from "./export-card";
import type { VideoExportPhase } from "../hooks/use-video-export";
import {
  videoExportCurrentFrame,
  type VideoExportFrameRange,
  type VideoExportQuality,
} from "../lib/video-export";
import { Button } from "./ui/button";
import { CardHeading } from "./ui/card-heading";
import { KeyValueList } from "./ui/kv-list";
import { SegmentedControl } from "./ui/segmented-control";

interface PlaybackPanelProps {
  project: LoadedProject | null;
  exportTitle?: string;
  snapshot: TransportSnapshot;
  activeNotes: MidiNoteEvent[];
  targetCount: number;
  totalFrames: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  stateLabel: string;
  onTogglePlayback(): void;
  onRewind(): void;
  onSeek(progress: number): void;
  onTempoScaleChange(scale: number): void;
  exportPhase: VideoExportPhase;
  exportActive: boolean;
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
  totalFrames,
  audioRef,
  stateLabel,
  onTogglePlayback,
  onRewind,
  onSeek,
  onTempoScaleChange,
  exportPhase,
  exportActive,
  exportProgress,
  exportError,
  onStartExport,
  onCancelExport,
}: PlaybackPanelProps) {
  const exportDurationMs = project?.midi.durationMs ?? 0;
  const currentFrame = videoExportCurrentFrame(snapshot.sourceTimeMs, totalFrames);
  return (
    <aside className="app-panel playback-panel">
      <div className="ui-card ui-stack sidebar-transport" aria-label="Playback controls / 播放控制">
        <audio ref={audioRef} aria-label="Score audio / 乐谱音频" />
        <CardHeading title="PREVIEW / 预览" status={stateLabel} />
        <div className="playback-buttons">
          <Button round onClick={onRewind} aria-label="Rewind / 回到开头">↺</Button>
          <Button variant="primary" pill onClick={onTogglePlayback}>
            {snapshot.state === "playing" ? "Pause / 暂停" : "Play / 播放"}
          </Button>
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

        <div className="speed-group">
          <span className="speed-label">Playback speed / 播放速度</span>
          <SegmentedControl
            label="Playback speed / 播放速度"
            options={[0.9, 0.95, 1].map((speed) => ({ value: speed, label: `${speed}×` }))}
            value={snapshot.tempoScale}
            onChange={onTempoScaleChange}
          />
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
        totalFrames={totalFrames}
        phase={exportPhase}
        active={exportActive}
        progress={exportProgress}
        error={exportError}
        onStart={onStartExport}
        onCancel={onCancelExport}
      />

      {project && (
        <KeyValueList
          variant="large"
          className="ui-card"
          items={[
            { label: "Score / 乐谱", value: project.score.title },
            { label: "Instruments / 乐器", value: project.score.partNames.join(" · ") || "—" },
            { label: "Measures / 小节", value: project.score.measureCount },
            { label: "MIDI notes / MIDI 音符", value: project.midi.noteCount },
            { label: "Tempo events / 速度事件", value: project.midi.tempoMap.length },
            { label: "SVG targets / SVG 落点", value: targetCount },
          ]}
        />
      )}
    </aside>
  );
}
