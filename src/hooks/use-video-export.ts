import { useCallback, useEffect, useRef, useState } from "react";
import { serializeProjectSettings, type ProjectSettings } from "../lib/project-settings";

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

export function useVideoExport(options: UseVideoExportOptions) {
  const [phase, setPhase] = useState<VideoExportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(async (fileName: string) => {
    if (!options.scoreFile || !options.midiFile || !options.audioFile || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase("preparing");
    setProgress(0);
    setError(null);
    options.beforeStart();
    try {
      const form = new FormData();
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
      saveBlob(await resultResponse.blob(), fileName);
      setProgress(1);
      setPhase("completed");
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
  }, [options.audioFile, options.backgroundFiles, options.beforeStart, options.midiFile, options.scoreFile, options.settings]);

  const cancel = useCallback(() => {
    const jobId = jobIdRef.current;
    controllerRef.current?.abort();
    if (jobId) void fetch(`/api/export/jobs/${jobId}`, { method: "DELETE" });
  }, []);

  const active = phase === "preparing" || phase === "rendering" || phase === "finalizing";
  return { phase, progress, error, active, start, cancel };
}
