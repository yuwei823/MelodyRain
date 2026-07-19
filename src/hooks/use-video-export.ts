import { useCallback, useEffect, useRef, useState } from "react";
import { serializeProjectSettings, type ProjectSettings } from "../lib/project-settings";
import type { VideoExportQuality } from "../lib/video-export";

export type VideoExportPhase =
  | "idle"
  | "preparing"
  | "rendering"
  | "finalizing"
  | "completed"
  | "cancelled"
  | "error";

interface UseVideoExportOptions {
  scoreFile: File | null;
  midiFile: File | null;
  audioFile: File | null;
  backgroundFiles: File[];
  settings: ProjectSettings;
  beforeStart(): void;
  saveToAssetFolder(blob: Blob, fileName: string): Promise<boolean>;
}

interface ExportJobStatus {
  id: string;
  phase: "queued" | "rendering" | "completed" | "cancelled" | "error";
  progress: number;
  error: string | null;
}

function wait(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, durationMs);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.toLowerCase().endsWith(".mp4") ? fileName : `${fileName}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function mp4FileName(fileName: string): string {
  return fileName.toLowerCase().endsWith(".mp4") ? fileName : `${fileName}.mp4`;
}

export function useVideoExport(options: UseVideoExportOptions) {
  const [phase, setPhase] = useState<VideoExportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(async (fileName: string, quality: VideoExportQuality) => {
    if (!options.scoreFile || !options.midiFile || !options.audioFile || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase("preparing");
    setProgress(0);
    setError(null);
    options.beforeStart();
    try {
      const form = new FormData();
      form.append("quality", quality);
      form.append("score", options.scoreFile);
      form.append("midi", options.midiFile);
      form.append("audio", options.audioFile);
      options.backgroundFiles.forEach((file) => form.append("background", file));
      form.append("settings", new File(
        [serializeProjectSettings(options.settings)],
        "melody-rain.settings.json",
        { type: "application/json" },
      ));
      const createResponse = await fetch("/api/export/jobs", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!createResponse.ok) throw new Error(`Unable to create export job (${createResponse.status}) / 无法创建导出任务`);
      let status = await createResponse.json() as ExportJobStatus;
      jobIdRef.current = status.id;
      setPhase("rendering");
      while (status.phase === "queued" || status.phase === "rendering") {
        await wait(500, controller.signal);
        const statusResponse = await fetch(`/api/export/jobs/${status.id}`, { signal: controller.signal });
        if (!statusResponse.ok) throw new Error(`Export status unavailable (${statusResponse.status}) / 无法读取导出进度`);
        status = await statusResponse.json() as ExportJobStatus;
        setProgress(status.progress);
      }
      if (status.phase === "cancelled") {
        setPhase("cancelled");
        return;
      }
      if (status.phase === "error") throw new Error(status.error || "Video export failed / 视频导出失败");
      setPhase("finalizing");
      const resultResponse = await fetch(`/api/export/jobs/${status.id}/result`, { signal: controller.signal });
      if (!resultResponse.ok) throw new Error(`Unable to download video (${resultResponse.status}) / 无法下载视频`);
      const blob = await resultResponse.blob();
      const completedFileName = mp4FileName(fileName);
      let savedToFolder = false;
      try {
        savedToFolder = await options.saveToAssetFolder(blob, completedFileName);
      } catch {
        savedToFolder = false;
      }
      if (!savedToFolder) saveBlob(blob, completedFileName);
      setProgress(1);
      setPhase("completed");
      window.alert(savedToFolder
        ? `Export completed and saved to the media folder: ${completedFileName} / 导出完成，已保存到素材文件夹：${completedFileName}`
        : `Export completed and downloaded: ${completedFileName} / 导出完成，文件已下载：${completedFileName}`);
      void fetch(`/api/export/jobs/${status.id}`, { method: "DELETE" });
    } catch (caught) {
      if (controller.signal.aborted) {
        setPhase("cancelled");
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
        setPhase("error");
      }
    } finally {
      controllerRef.current = null;
      jobIdRef.current = null;
    }
  }, [options.audioFile, options.backgroundFiles, options.beforeStart, options.midiFile, options.saveToAssetFolder, options.scoreFile, options.settings]);

  const cancel = useCallback(() => {
    const jobId = jobIdRef.current;
    controllerRef.current?.abort();
    if (jobId) void fetch(`/api/export/jobs/${jobId}`, { method: "DELETE" });
  }, []);

  const active = phase === "preparing" || phase === "rendering" || phase === "finalizing";
  return { phase, progress, error, active, start, cancel };
}
