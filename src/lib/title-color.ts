export type TitleColorMode = "auto" | "custom";

export const DARK_TITLE_COLOR = "#25364A";
export const LIGHT_TITLE_COLOR = "#F4F7FB";

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function linearChannel(channel: number): number {
  const value = Math.min(255, Math.max(0, channel)) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ red, green, blue }: RgbColor): number {
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

function contrastRatio(left: number, right: number): number {
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbFromHex(color: string): RgbColor | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return null;
  return {
    red: Number.parseInt(match[1]!, 16),
    green: Number.parseInt(match[2]!, 16),
    blue: Number.parseInt(match[3]!, 16),
  };
}

export function readableTitleColor(background: RgbColor): string {
  const backgroundLuminance = relativeLuminance(background);
  const dark = relativeLuminance(rgbFromHex(DARK_TITLE_COLOR)!);
  const light = relativeLuminance(rgbFromHex(LIGHT_TITLE_COLOR)!);
  return contrastRatio(backgroundLuminance, dark) >= contrastRatio(backgroundLuminance, light)
    ? DARK_TITLE_COLOR
    : LIGHT_TITLE_COLOR;
}

export function readableTitleColorForSolid(backgroundColor: string): string {
  const background = rgbFromHex(backgroundColor);
  return background ? readableTitleColor(background) : LIGHT_TITLE_COLOR;
}

export async function readableTitleColorForImage(imageUrl: string): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to read the title-area background image / 无法读取标题区域背景图片"));
    image.src = imageUrl;
  });

  // A small 9:16 canvas is sufficient for luminance sampling and mirrors the
  // same center-cropped `cover` geometry used by the stage background.
  const width = 72;
  const height = 128;
  const titleBandHeight = Math.ceil(height * 78 / 960);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return LIGHT_TITLE_COLOR;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - renderedWidth) / 2, (height - renderedHeight) / 2, renderedWidth, renderedHeight);
  const pixels = context.getImageData(0, 0, width, titleBandHeight).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]! / 255;
    red += pixels[index]! * alpha;
    green += pixels[index + 1]! * alpha;
    blue += pixels[index + 2]! * alpha;
    samples += alpha;
  }
  if (samples === 0) return LIGHT_TITLE_COLOR;
  return readableTitleColor({ red: red / samples, green: green / samples, blue: blue / samples });
}
