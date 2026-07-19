import { describe, expect, it } from "vitest";
import { PORTRAIT_ASPECT_RATIO, PORTRAIT_RENDER_PROFILE } from "./render-profile";

describe("portrait render profile", () => {
  it("uses the single 1080x1920 MVP frame", () => {
    expect(PORTRAIT_RENDER_PROFILE).toMatchObject({
      id: "portrait-9x16",
      orientation: "portrait",
      width: 1080,
      height: 1920,
      fps: 30,
      scoreScale: 2 / 3,
      measuresPerSystem: 2,
    });
    expect(PORTRAIT_RENDER_PROFILE.width / PORTRAIT_RENDER_PROFILE.height).toBe(9 / 16);
    expect(PORTRAIT_ASPECT_RATIO).toBe("1080 / 1920");
    expect(PORTRAIT_RENDER_PROFILE.scoreScale).toBeCloseTo(0.666667, 5);
  });
});
