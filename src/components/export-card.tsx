import { useEffect, useState } from "react";
import { formatDuration } from "../lib/format";
import {
  VIDEO_EXPORT_PROFILES,
  validVideoExportFrameRange,
  type VideoExportFrameRange,
  type VideoExportQuality,
} from "../lib/video-export";
import type { VideoExportPhase } from "../hooks/use-video-export";
import { Button } from "./ui/button";
import { CardHeading } from "./ui/card-heading";
import { KeyValueList } from "./ui/kv-list";
import { SegmentedControl } from "./ui/segmented-control";

interface ExportCardProps {
  projectLabel?: string;
  durationMs?: number;
  totalFrames: number;
  phase: VideoExportPhase;
  active: boolean;
  progress: number;
  error: string | null;
  onStart(fileName: string, quality: VideoExportQuality, frameRange: VideoExportFrameRange): void;
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
  totalFrames,
  phase,
  active,
  progress,
  error,
  onStart,
  onCancel,
}: ExportCardProps) {
  const [fileName, setFileName] = useState(exportFileName(projectLabel));
  const [quality, setQuality] = useState<VideoExportQuality>("standard");
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(totalFrames);
  const profile = VIDEO_EXPORT_PROFILES[quality];
  const frameRange = { startFrame, endFrame };
  const validRange = validVideoExportFrameRange(frameRange, totalFrames);
  const resetRange = () => {
    setStartFrame(0);
    setEndFrame(totalFrames);
  };
  useEffect(() => { setFileName(exportFileName(projectLabel)); }, [projectLabel]);
  useEffect(resetRange, [totalFrames]);
  return (
    <section className="ui-card ui-stack export-card" aria-labelledby="export-card-title">
      <CardHeading id="export-card-title" title="EXPORT / 视频导出" status={PHASE_LABELS[phase]} />

      <fieldset className="export-field" disabled={active}>
        <legend>Quality / 导出质量</legend>
        <SegmentedControl<VideoExportQuality>
          label="Quality / 导出质量"
          options={(Object.entries(VIDEO_EXPORT_PROFILES) as Array<
            [VideoExportQuality, (typeof VIDEO_EXPORT_PROFILES)[VideoExportQuality]]
          >).map(([value, option]) => ({
            value,
            label: (
              <span className="segmented-option">
                <strong>{option.label}</strong>
                <small>{option.width} × {option.height}</small>
              </span>
            ),
          }))}
          value={quality}
          onChange={setQuality}
        />
      </fieldset>

      <KeyValueList
        variant="boxed"
        ariaLabel="Export settings / 导出设置"
        items={[
          { label: "Resolution / 分辨率", value: `${profile.width} × ${profile.height}` },
          { label: "Frame rate / 帧率", value: `${profile.fps} FPS` },
          { label: "Format / 格式", value: "MP4 · H.264" },
          { label: "Duration / 时长", value: formatDuration(durationMs) },
          { label: "Total frames / 总帧数", value: durationMs > 0 ? totalFrames : "—" },
        ]}
      />

      <fieldset className="export-field" disabled={active || durationMs <= 0}>
        <legend>Frame range / 导出帧范围</legend>
        <div className="frame-range-fields">
          <label>
            <span>Start frame / 起始帧</span>
            <input
              type="text"
              inputMode="numeric"
              value={startFrame + 1}
              onChange={(event) => {
                const raw = event.target.value;
                if (/^\d+$/.test(raw)) setStartFrame(Number(raw) - 1);
              }}
            />
          </label>
          <label>
            <span>End frame / 结束帧</span>
            <input
              type="text"
              inputMode="numeric"
              value={endFrame}
              onChange={(event) => {
                const raw = event.target.value;
                if (/^\d+$/.test(raw)) setEndFrame(Number(raw));
              }}
            />
          </label>
        </div>
        <small>
          Frames {startFrame + 1}–{endFrame} · {validRange ? endFrame - startFrame : 0} frames / 帧
        </small>
        <small>
          {formatDuration(startFrame * 1_000 / profile.fps)}–{formatDuration(endFrame * 1_000 / profile.fps)}
        </small>
        <Button variant="ghost" compact className="export-full-range" onClick={resetRange}>
          Full range / 完整范围
        </Button>
      </fieldset>

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
          <progress max="1" value={progress} aria-label="Export progress / 导出进度" />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}
      {error && <small className="export-error" role="alert">{error}</small>}
      <Button
        variant={active ? "danger" : "primary"}
        className="export-button"
        disabled={!active && (!projectLabel || !fileName.trim() || !validRange)}
        onClick={() => active ? onCancel() : onStart(fileName.trim(), quality, frameRange)}
      >
        {active ? "Cancel export / 取消导出" : "Export video / 导出视频"}
      </Button>
      <small>Rendered locally with Chrome and FFmpeg. / 使用本地 Chrome 与 FFmpeg 渲染。</small>
    </section>
  );
}
