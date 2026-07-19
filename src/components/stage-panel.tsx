import type { RefObject } from "react";
import { PORTRAIT_ASPECT_RATIO, PORTRAIT_RENDER_PROFILE } from "../lib/render-profile";

interface StagePanelProps {
  title: string;
  titleColor: string;
  scoreViewportRef: RefObject<HTMLDivElement | null>;
  scoreContentClipRef: RefObject<HTMLDivElement | null>;
  scoreHostRef: RefObject<HTMLDivElement | null>;
  exportFrameRef: RefObject<HTMLDivElement | null>;
}

export function StagePanel({ title, titleColor, scoreViewportRef, scoreContentClipRef, scoreHostRef, exportFrameRef }: StagePanelProps) {
  return (
    <section className="app-panel stage-panel">
      <div className="stage-preview-wrap">
        <div
          ref={exportFrameRef}
          className="portrait-frame"
          style={{ aspectRatio: PORTRAIT_ASPECT_RATIO }}
          data-render-profile={PORTRAIT_RENDER_PROFILE.id}
          aria-label="1080 × 1920 portrait video preview / 竖屏视频预览"
        >
          <div className="stage-toolbar">
            <div><h2 style={{ color: titleColor }}>{title}</h2></div>
          </div>
          <div ref={scoreViewportRef} className="score-viewport">
            <div ref={scoreContentClipRef} className="score-content-clip">
              <div ref={scoreHostRef} className="score-host" aria-label="SVG sheet music preview / SVG 五线谱预览" />
            </div>
          </div>
        </div>
        <div className="frame-caption">
          <span>Portrait video / 竖屏视频画幅</span>
          <strong>{PORTRAIT_RENDER_PROFILE.width} × {PORTRAIT_RENDER_PROFILE.height}</strong>
          <span>9:16 · {PORTRAIT_RENDER_PROFILE.fps} FPS</span>
        </div>
      </div>
    </section>
  );
}
