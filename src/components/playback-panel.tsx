import type { RefObject } from "react";
import { formatDuration } from "../lib/format";
import type { MidiNoteEvent } from "../lib/midi";
import type { TransportSnapshot } from "../lib/transport";
import type { LoadedProject } from "../hooks/use-project-loader";

interface PlaybackPanelProps {
  project: LoadedProject | null;
  snapshot: TransportSnapshot;
  activeNotes: MidiNoteEvent[];
  targetCount: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  stateLabel: string;
  onTogglePlayback(): void;
  onRewind(): void;
  onSeek(progress: number): void;
  onTempoScaleChange(scale: number): void;
}

export function PlaybackPanel({
  project,
  snapshot,
  activeNotes,
  targetCount,
  audioRef,
  stateLabel,
  onTogglePlayback,
  onRewind,
  onSeek,
  onTempoScaleChange,
}: PlaybackPanelProps) {
  return (
    <aside className="playback-panel">
      <div className="sidebar-transport" aria-label="播放控制">
        <audio ref={audioRef} aria-label="乐谱音频" />
        <div className="sidebar-transport-heading">
          <p className="step-label">PLAYBACK</p>
          <span>{stateLabel}</span>
        </div>
        <div className="playback-buttons">
          <button className="round-button" type="button" onClick={onRewind} aria-label="回到开头">↺</button>
          <button className="play-button" type="button" onClick={onTogglePlayback}>
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
            onChange={(event) => onSeek(Number(event.target.value))}
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
              onClick={() => onTempoScaleChange(speed)}
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
  );
}
