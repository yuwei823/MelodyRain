import { useEffect, useState } from "react";
import { formatDuration } from "../lib/format";
import { VIDEO_EXPORT_PROFILES, videoExportFrameCount, type VideoExportQuality } from "../lib/video-export";
import type { VideoExportPhase } from "../hooks/use-video-export";

interface ExportCardProps {
  projectLabel?: string;
  durationMs?: number;
  phase: VideoExportPhase;
  progress: number;
  error: string | null;
  onStart(fileName: string, quality: VideoExportQuality): void;
  onCancel(): void;
}

function exportFileName(projectLabel?: string): string {
  const baseName = projectLabel
    ?.replace(/\.(mxl|musicxml|xml)$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "") || "melody-rain";
  return `${baseName}.mp4`;
}

const PHASE_LABELS: Record<VideoExportPhase, string> = {
  idle: "Ready / 就绪",
  preparing: "Preparing / 准备中",
  rendering: "Rendering / 渲染中",
  finalizing: "Finalizing / 封装中",
  completed: "Completed / 已完成",
  cancelled: "Cancelled / 已取消",
  error: "Failed / 失败",
};

export function ExportCard({
  projectLabel,
  durationMs = 0,
  phase,
  progress,
  error,
  onStart,
  onCancel,
}: ExportCardProps) {
  const totalFrames = videoExportFrameCount(durationMs);
  const [fileName, setFileName] = useState(exportFileName(projectLabel));
  const [quality, setQuality] = useState<VideoExportQuality>("standard");
  const profile = VIDEO_EXPORT_PROFILES[quality];
  const active = phase === "preparing" || phase === "rendering" || phase === "finalizing";
  useEffect(() => { setFileName(exportFileName(projectLabel)); }, [projectLabel]);
  return (
    <section className="ui-card ui-stack export-card" aria-labelledby="export-card-title">
      <div className="export-card-heading">
        <p className="step-label" id="export-card-title">EXPORT / 视频导出</p>
        <span>{PHASE_LABELS[phase]}</span>
      </div>

      <fieldset className="export-quality" disabled={active}>
        <legend>Quality / 导出质量</legend>
        {(Object.entries(VIDEO_EXPORT_PROFILES) as Array<
          [VideoExportQuality, (typeof VIDEO_EXPORT_PROFILES)[VideoExportQuality]]
        >).map(([value, option]) => (
          <label key={value} className={quality === value ? "is-active" : ""}>
            <input
              type="radio"
              name="export-quality"
              value={value}
              checked={quality === value}
              onChange={() => setQuality(value)}
            />
            <strong>{option.label}</strong>
            <small>{option.width} × {option.height}</small>
          </label>
        ))}
      </fieldset>

      <div className="export-specs" aria-label="Export settings / 导出设置">
        <div><span>Resolution / 分辨率</span><strong>{profile.width} × {profile.height}</strong></div>
        <div><span>Frame rate / 帧率</span><strong>{profile.fps} FPS</strong></div>
        <div><span>Format / 格式</span><strong>MP4 · H.264</strong></div>
        <div><span>Duration / 时长</span><strong>{formatDuration(durationMs)}</strong></div>
        <div><span>Total frames / 总帧数</span><strong>{durationMs > 0 ? totalFrames : "—"}</strong></div>
      </div>

      <label className="export-file-name">
        <span>File name / 文件名</span>
        <input
          type="text"
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          aria-label="Export file name / 导出文件名"
          disabled={active}
        />
      </label>

      {active && (
        <div className="export-progress" aria-live="polite">
          <progress max="1" value={progress} />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}
      {error && <small className="export-error">{error}</small>}
      <button
        className="export-button"
        type="button"
        disabled={!active && (!projectLabel || !fileName.trim())}
        onClick={() => active ? onCancel() : onStart(fileName.trim(), quality)}
      >
        {active ? "Cancel export / 取消导出" : "Export video / 导出视频"}
      </button>
      <small>Rendered locally with Chrome and FFmpeg. / 使用本地 Chrome 与 FFmpeg 渲染。</small>
    </section>
  );
}
