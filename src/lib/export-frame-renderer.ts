import { VIDEO_EXPORT_PROFILE } from "./video-export";

export interface ExportFrameSize {
  width: number;
  height: number;
}

function readableStyleText(): string {
  return [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules].map((rule) => rule.cssText);
    } catch {
      return [];
    }
  }).join("\n");
}

export function exportFrameSize(
  width: number = VIDEO_EXPORT_PROFILE.width,
  height: number = VIDEO_EXPORT_PROFILE.height,
): ExportFrameSize {
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export function createExportCanvas(size = exportFrameSize()): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

function serializedFrameSvg(frame: HTMLElement, size: ExportFrameSize): string {
  const bounds = frame.getBoundingClientRect();
  const sourceWidth = Math.max(1, bounds.width || frame.clientWidth);
  const sourceHeight = Math.max(1, bounds.height || frame.clientHeight);
  const clone = frame.cloneNode(true) as HTMLElement;
  clone.style.width = `${sourceWidth}px`;
  clone.style.height = `${sourceHeight}px`;
  clone.style.maxWidth = "none";
  clone.style.aspectRatio = "auto";
  const markup = new XMLSerializer().serializeToString(clone);
  const styles = readableStyleText();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">
    <foreignObject width="${sourceWidth}" height="${sourceHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${sourceWidth}px;height:${sourceHeight}px;overflow:hidden">
        <style>${styles.replaceAll("</style>", "<\\/style>")}</style>
        ${markup}
      </div>
    </foreignObject>
  </svg>`;
}

async function imageFromSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to rasterize export frame / 无法栅格化导出画面"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class ExportFrameRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;

  constructor(
    private readonly frame: HTMLElement,
    readonly size = exportFrameSize(),
  ) {
    this.canvas = createExportCanvas(size);
    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable / Canvas 2D 不可用");
    this.context = context;
  }

  async prepare(): Promise<void> {
    await document.fonts?.ready;
    const images = [...this.frame.querySelectorAll<HTMLImageElement>("img")];
    await Promise.all(images.map((image) => image.complete ? undefined : image.decode()));
  }

  async render(): Promise<HTMLCanvasElement> {
    const image = await imageFromSvg(serializedFrameSvg(this.frame, this.size));
    this.context.fillStyle = "#eef1f5";
    this.context.fillRect(0, 0, this.size.width, this.size.height);
    this.context.drawImage(image, 0, 0, this.size.width, this.size.height);
    return this.canvas;
  }
}
