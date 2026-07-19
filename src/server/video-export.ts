import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chromium, type Browser } from "playwright-core";

export type ExportPhase = "queued" | "rendering" | "completed" | "cancelled" | "error";
export type ExportQuality = "high" | "standard";

export interface ExportAsset {
  field: string;
  name: string;
  path: string;
  contentType: string;
}

export interface ExportJob {
  id: string;
  phase: ExportPhase;
  progress: number;
  completedFrames: number;
  totalFrames: number;
  error: string | null;
  directory: string;
  outputPath: string;
  assets: ExportAsset[];
  createdAt: number;
  browser?: Browser;
  ffmpeg?: ChildProcessWithoutNullStreams;
  cancelled: boolean;
  quality: ExportQuality;
  startFrame: number;
  endFrame: number;
}

const jobs = new Map<string, ExportJob>();
const FPS = 30;
const PRE_ROLL_MS = 1_200;

function chromeExecutable(): string {
  const candidates = [
    process.env.MELODY_RAIN_CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((value): value is string => Boolean(value));
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (!selected) throw new Error("Chrome executable not found / 未找到 Chrome");
  return selected;
}

export async function createExportJob(
  root: string,
  uploaded: Array<{ fieldname: string; originalname: string; path: string; mimetype: string }>,
  quality: ExportQuality,
  frameRange: { startFrame: number; endFrame: number },
): Promise<ExportJob> {
  const id = randomUUID();
  const directory = path.join(root, id);
  await mkdir(directory, { recursive: true });
  const assets: ExportAsset[] = [];
  for (const [index, file] of uploaded.entries()) {
    const targetPath = path.join(directory, `${index}-${path.basename(file.originalname)}`);
    await rename(file.path, targetPath);
    assets.push({
      field: file.fieldname,
      name: path.basename(file.originalname),
      path: targetPath,
      contentType: file.mimetype || "application/octet-stream",
    });
  }
  const job: ExportJob = {
    id,
    phase: "queued",
    progress: 0,
    completedFrames: 0,
    totalFrames: 0,
    error: null,
    directory,
    outputPath: path.join(directory, "melody-rain.mp4"),
    assets,
    createdAt: Date.now(),
    cancelled: false,
    quality,
    startFrame: frameRange.startFrame,
    endFrame: frameRange.endFrame,
  };
  jobs.set(id, job);
  return job;
}

export function exportJob(id: string): ExportJob | undefined {
  return jobs.get(id);
}

export function exportJobStatus(job: ExportJob) {
  return {
    id: job.id,
    phase: job.phase,
    progress: job.progress,
    completedFrames: job.completedFrames,
    totalFrames: job.totalFrames,
    error: job.error,
    quality: job.quality,
    startFrame: job.startFrame,
    endFrame: job.endFrame,
  };
}

export function exportJobManifest(job: ExportJob) {
  return {
    id: job.id,
    assets: job.assets.map((asset, index) => ({
      field: asset.field,
      name: asset.name,
      url: `/api/export/jobs/${job.id}/assets/${index}`,
    })),
  };
}

function writeFrame(stream: NodeJS.WritableStream, frame: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.removeListener("drain", handleDrain);
      stream.removeListener("error", handleError);
    };
    const handleDrain = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    stream.once("error", handleError);
    try {
      if (stream.write(frame)) {
        cleanup();
        resolve();
        return;
      }
      stream.once("drain", handleDrain);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function waitForProcess(process: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.once("error", reject);
    process.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}: ${stderr.slice(-1_500)}`)));
  });
}

export async function runExportJob(job: ExportJob, appUrl: string): Promise<void> {
  const audio = job.assets.find((asset) => asset.field === "audio");
  if (!audio) throw new Error("Audio file missing / 缺少音频文件");
  try {
    job.phase = "rendering";
    const browser = await chromium.launch({
      executablePath: chromeExecutable(),
      headless: true,
      args: ["--disable-gpu-sandbox"],
    });
    job.browser = browser;
    const context = await browser.newContext({
      viewport: { width: 900, height: 1100 },
      deviceScaleFactor: job.quality === "high" ? 2 : 1,
    });
    const page = await context.newPage();
    await page.goto(`${appUrl}/?exportJob=${job.id}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.exportReady === "true", undefined, { timeout: 60_000 });
    const durationMs = await page.evaluate(() => Number(document.documentElement.dataset.exportDurationMs ?? 0));
    const fullFrameCount = Math.ceil(((durationMs + PRE_ROLL_MS) * FPS) / 1_000) + 1;
    if (job.startFrame < 0 || job.startFrame >= job.endFrame || job.endFrame > fullFrameCount) {
      throw new Error(`Invalid export frame range ${job.startFrame}–${job.endFrame}; full range is 0–${fullFrameCount}`);
    }
    job.totalFrames = job.endFrame - job.startFrame;
    const rangeStartSeconds = job.startFrame / FPS;
    const rangeDurationSeconds = job.totalFrames / FPS;
    const audioDelaySeconds = Math.max(0, PRE_ROLL_MS / 1_000 - rangeStartSeconds);
    const audioSeekSeconds = Math.max(0, rangeStartSeconds - PRE_ROLL_MS / 1_000);
    const ffmpeg = spawn("ffmpeg", [
      "-y", "-f", "image2pipe", "-vcodec", "png", "-framerate", String(FPS), "-i", "pipe:0",
      ...(audioDelaySeconds > 0 ? ["-itsoffset", String(audioDelaySeconds)] : []),
      ...(audioSeekSeconds > 0 ? ["-ss", String(audioSeekSeconds)] : []),
      "-i", audio.path,
      "-c:v", "libx264",
      "-preset", job.quality === "high" ? "medium" : "veryfast",
      "-crf", job.quality === "high" ? "18" : "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-t", String(rangeDurationSeconds),
      "-movflags", "+faststart", job.outputPath,
    ], { stdio: ["pipe", "pipe", "pipe"] });
    job.ffmpeg = ffmpeg;
    const ffmpegDone = waitForProcess(ffmpeg);
    const frameElement = page.locator(".portrait-frame");
    for (let index = 0; index < job.totalFrames; index += 1) {
      if (job.cancelled) throw new Error("EXPORT_CANCELLED");
      const absoluteFrame = job.startFrame + index;
      const sourceTimeMs = absoluteFrame * 1_000 / FPS - PRE_ROLL_MS;
      await page.evaluate(async (timeMs) => {
        const api = (window as unknown as { __MELODY_RAIN_EXPORT__?: { renderFrame(time: number): Promise<void> } }).__MELODY_RAIN_EXPORT__;
        if (!api) throw new Error("Export frame API unavailable");
        await api.renderFrame(timeMs);
      }, sourceTimeMs);
      const image = await frameElement.screenshot({ type: "png", animations: "disabled" });
      await writeFrame(ffmpeg.stdin, image);
      job.completedFrames = index + 1;
      job.progress = job.completedFrames / job.totalFrames;
    }
    ffmpeg.stdin.end();
    await ffmpegDone;
    job.phase = "completed";
    job.progress = 1;
  } catch (error) {
    if (job.cancelled || (error instanceof Error && error.message === "EXPORT_CANCELLED")) {
      job.phase = "cancelled";
    } else {
      job.phase = "error";
      job.error = error instanceof Error ? error.message : String(error);
    }
    job.ffmpeg?.kill();
  } finally {
    await job.browser?.close().catch(() => undefined);
    job.browser = undefined;
    job.ffmpeg = undefined;
  }
}

export async function cancelExportJob(job: ExportJob): Promise<void> {
  job.cancelled = true;
  job.ffmpeg?.kill();
  await job.browser?.close().catch(() => undefined);
}

export async function removeExportJob(job: ExportJob): Promise<void> {
  jobs.delete(job.id);
  await rm(job.directory, { recursive: true, force: true });
}

export function exportResultStream(job: ExportJob) {
  return createReadStream(job.outputPath);
}
