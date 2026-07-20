import { VIDEO_EXPORT_FPS } from "./video-export.js";

export interface RenderProfile {
  id: string;
  orientation: "portrait";
  width: number;
  height: number;
  fps: number;
  scoreScale: number;
  measuresPerSystem: number;
}

export const PORTRAIT_RENDER_PROFILE: Readonly<RenderProfile> = Object.freeze({
  id: "portrait-9x16",
  orientation: "portrait",
  width: 1080,
  height: 1920,
  fps: VIDEO_EXPORT_FPS,
  scoreScale: 2 / 3,
  measuresPerSystem: 2,
});

export const PORTRAIT_ASPECT_RATIO = `${PORTRAIT_RENDER_PROFILE.width} / ${PORTRAIT_RENDER_PROFILE.height}`;
