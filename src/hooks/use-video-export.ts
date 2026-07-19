import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { LoadedProject } from "./use-project-loader";
import { downloadVideoBlob, encodeMp4Video } from "../lib/mp4-video-exporter";
import type { TransportSnapshot } from "../lib/transport";
import { VideoExportCancelledError } from "../lib/video-export-session";

export type VideoExportPhase =
  | "idle"
  | "preparing"
  | "rendering"
  | "finalizing"
  | "completed"
  | "cancelled"
  | "error";

interface UseVideoExportOptions {
  project: LoadedProject | null;
  frameRef: RefObject<HTMLElement | null>;
  updateStage(snapshot: TransportSnapshot): void;
  currentSnapshot: TransportSnapshot;
  beforeStart(): void;
}

export function useVideoExport(options: UseVideoExportOptions) {
  const [phase, setPhase] = useState<VideoExportPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef(options.currentSnapshot);
  const progressPercentRef = useRef(-1);
  snapshotRef.current = options.currentSnapshot;

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    controllerRef.current?.abort();
    setPhase("idle");
    setProgress(0);
    progressPercentRef.current = -1;
    setError(null);
  }, [options.project]);

  const start = useCallback(async (fileName: string) => {
    const project = options.project;
    const frameElement = options.frameRef.current;
    if (!project || !frameElement || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setProgress(0);
    setError(null);
    options.beforeStart();
    try {
      const blob = await encodeMp4Video({
        frameElement,
        audioUrl: project.audioUrl,
        midi: project.midi,
        durationMs: project.midi.durationMs,
        updateStage: options.updateStage,
        onProgress: (value) => {
          const percent = Math.floor(value * 100);
          if (percent === progressPercentRef.current) return;
          progressPercentRef.current = percent;
          setProgress(value);
        },
        onPhase: setPhase,
        signal: controller.signal,
      });
      downloadVideoBlob(blob, fileName.toLowerCase().endsWith(".mp4") ? fileName : `${fileName}.mp4`);
      setProgress(1);
      setPhase("completed");
    } catch (caught) {
      if (caught instanceof VideoExportCancelledError || controller.signal.aborted) {
        setPhase("cancelled");
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
        setPhase("error");
      }
    } finally {
      controllerRef.current = null;
      options.updateStage(snapshotRef.current);
    }
  }, [options.beforeStart, options.frameRef, options.project, options.updateStage]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  const active = phase === "preparing" || phase === "rendering" || phase === "finalizing";
  return { phase, progress, error, active, start, cancel };
}
