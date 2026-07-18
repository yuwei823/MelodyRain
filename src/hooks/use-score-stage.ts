import { useCallback, useEffect, useRef, useState } from "react";
import { MidiTimeline } from "../lib/midi";
import { PerformanceEffectLayer, mergePerformanceVisuals, type PerformanceEffectConfig } from "../lib/performance-effect-layer";
import { RainLayer } from "../lib/rain-layer";
import { PORTRAIT_RENDER_PROFILE } from "../lib/render-profile";
import { ScoreCamera } from "../lib/score-camera";
import { ScoreMaskLayer, type ScoreMaskSource } from "../lib/score-mask-layer";
import { ScoreRenderer } from "../lib/score-renderer";
import { ScoreTimelineLayer } from "../lib/score-timeline-layer";
import { TRANSPORT_PRE_ROLL_MS, type TransportSnapshot } from "../lib/transport";
import type { LoadedProject } from "./use-project-loader";

interface ScoreStageOptions {
  project: LoadedProject | null;
  measuresPerSystem: number;
  maskSource: ScoreMaskSource;
  maskBlackMixPercent: number;
  paperTransparencyPercent: number;
  performanceEffectConfig: PerformanceEffectConfig;
  currentSourceTimeMs(): number;
  setStatus(status: string): void;
  setError(error: string | null): void;
}

export function useScoreStage(options: ScoreStageOptions) {
  const { project, measuresPerSystem, maskSource, maskBlackMixPercent, paperTransparencyPercent,
    performanceEffectConfig, currentSourceTimeMs, setStatus, setError } = options;
  const [targetCount, setTargetCount] = useState(0);
  const scoreHostRef = useRef<HTMLDivElement>(null);
  const scoreViewportRef = useRef<HTMLDivElement>(null);
  const scoreContentClipRef = useRef<HTMLDivElement>(null);
  const rainLayerRef = useRef<RainLayer | null>(null);
  const scoreTimelineLayerRef = useRef<ScoreTimelineLayer | null>(null);
  const scoreCameraRef = useRef<ScoreCamera | null>(null);
  const scoreMaskLayerRef = useRef<ScoreMaskLayer | null>(null);
  const performanceEffectLayerRef = useRef<PerformanceEffectLayer | null>(null);
  const maskSourceRef = useRef(maskSource);
  const maskBlackMixPercentRef = useRef(maskBlackMixPercent);
  const paperTransparencyPercentRef = useRef(paperTransparencyPercent);
  const performanceEffectConfigRef = useRef(performanceEffectConfig);
  maskSourceRef.current = maskSource;
  maskBlackMixPercentRef.current = maskBlackMixPercent;
  paperTransparencyPercentRef.current = paperTransparencyPercent;
  performanceEffectConfigRef.current = performanceEffectConfig;

  const update = useCallback((snapshot: TransportSnapshot) => {
    rainLayerRef.current?.update(snapshot.sourceTimeMs);
    scoreTimelineLayerRef.current?.update(snapshot.sourceTimeMs);
    scoreCameraRef.current?.update(snapshot.scoreQuarter);
    performanceEffectLayerRef.current?.update();
  }, []);

  useEffect(() => {
    const host = scoreHostRef.current;
    const contentClip = scoreContentClipRef.current;
    if (!host || !contentClip || !project) return;
    let cancelled = false;
    const disposeLayers = () => {
      [rainLayerRef.current, scoreTimelineLayerRef.current, scoreCameraRef.current,
        scoreMaskLayerRef.current, performanceEffectLayerRef.current].forEach((layer) => layer?.dispose());
      rainLayerRef.current = null;
      scoreTimelineLayerRef.current = null;
      scoreCameraRef.current = null;
      scoreMaskLayerRef.current = null;
      performanceEffectLayerRef.current = null;
    };
    disposeLayers();
    const renderHost = document.createElement("div");
    renderHost.className = "score-render-content";
    host.replaceChildren(renderHost);
    setTargetCount(0);
    setStatus("正在排版 SVG 五线谱…");
    const renderer = new ScoreRenderer(renderHost);
    void renderer.render(project.musicXml, measuresPerSystem, PORTRAIT_RENDER_PROFILE.scoreScale)
      .then(({ targets, restSymbols, revealElements, growingSpans, maskElements }) => {
        if (cancelled) return;
        const timeline = new MidiTimeline(project.midi);
        const rainLayer = new RainLayer(host, timeline);
        rainLayer.setEvents(project.midi.events, targets, restSymbols);
        const timeMs = currentSourceTimeMs() ?? -TRANSPORT_PRE_ROLL_MS - 1;
        rainLayer.update(timeMs);
        rainLayerRef.current = rainLayer;
        const timelineLayer = new ScoreTimelineLayer(timeline);
        timelineLayer.setElements(revealElements, growingSpans);
        timelineLayer.update(timeMs);
        scoreTimelineLayerRef.current = timelineLayer;
        const viewport = scoreViewportRef.current;
        if (viewport) {
          const effectLayer = new PerformanceEffectLayer(viewport, viewport);
          effectLayer.setVisuals(mergePerformanceVisuals(rainLayer.performanceVisuals(), timelineLayer.performanceVisuals()));
          effectLayer.setSource(maskSourceRef.current);
          effectLayer.setConfig(performanceEffectConfigRef.current);
          effectLayer.update();
          performanceEffectLayerRef.current = effectLayer;
          const maskLayer = new ScoreMaskLayer(viewport, host);
          maskLayer.setElements(maskElements);
          maskLayer.setSource(maskSourceRef.current);
          maskLayer.setBlackMix(maskBlackMixPercentRef.current / 100);
          maskLayer.setPaperTransparency(paperTransparencyPercentRef.current / 100);
          scoreMaskLayerRef.current = maskLayer;
          const camera = new ScoreCamera(viewport, contentClip, host);
          camera.setAnchors([
            ...targets.map((target) => ({ scoreQuarter: target.scoreQuarter, x: target.x, y: target.y })),
            ...restSymbols.map((rest) => ({ scoreQuarter: rest.scoreQuarter, x: rest.x, y: rest.y })),
          ]);
          camera.update(timeline.scoreQuarterAt(timeMs));
          scoreCameraRef.current = camera;
        }
        setTargetCount(targets.length);
        setStatus("谱面、MIDI 与音频已就绪");
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
      disposeLayers();
      renderHost.remove();
    };
  }, [currentSourceTimeMs, measuresPerSystem, project, setError, setStatus]);

  useEffect(() => {
    scoreMaskLayerRef.current?.setSource(maskSource);
    performanceEffectLayerRef.current?.setSource(maskSource);
  }, [maskSource]);
  useEffect(() => { performanceEffectLayerRef.current?.setConfig(performanceEffectConfig); }, [performanceEffectConfig]);
  useEffect(() => { scoreMaskLayerRef.current?.setBlackMix(maskBlackMixPercent / 100); }, [maskBlackMixPercent]);
  useEffect(() => { scoreMaskLayerRef.current?.setPaperTransparency(paperTransparencyPercent / 100); }, [paperTransparencyPercent]);

  return { targetCount, scoreHostRef, scoreViewportRef, scoreContentClipRef, update };
}
