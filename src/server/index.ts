import cors from "cors";
import express from "express";
import path from "node:path";
import os from "node:os";
import { mkdirSync } from "node:fs";
import multer from "multer";
import { readAppVersion } from "./app-version.js";
import {
  cancelExportJob,
  cleanupStaleExportJobs,
  createExportJob,
  exportJob,
  exportJobManifest,
  exportJobStatus,
  type ExportQuality,
  removeExportJob,
  runExportJob,
} from "./video-export.js";

const host = "127.0.0.1";
const port = Number(process.env.MELODY_RAIN_PORT ?? 4174);
const projectRoot = process.cwd();
const appVersion = readAppVersion(projectRoot);
const demoRoot = path.join(projectRoot, "sample/ode-to-joy");
const webRoot = path.join(projectRoot, "dist");
const exportRoot = path.join(os.tmpdir(), "melody-rain-exports");
const uploadRoot = path.join(exportRoot, "uploads");
mkdirSync(uploadRoot, { recursive: true });
const upload = multer({ dest: uploadRoot, limits: { fileSize: 100 * 1024 * 1024, files: 16 } });
const MAX_CONCURRENT_EXPORT_JOBS = 2;
let activeExportJobs = 0;
void cleanupStaleExportJobs(exportRoot);

const demoAssets = {
  score: { file: "ode-to-joy-easy-variation.mxl", contentType: "application/vnd.recordare.musicxml" },
  midi: { file: "ode-to-joy-easy-variation.mid", contentType: "audio/midi" },
  audio: { file: "ode-to-joy-easy-variation.mp3", contentType: "audio/mpeg" },
  background: { file: "background.jpeg", contentType: "image/jpeg" },
  settings: { file: "melody-rain.settings.json", contentType: "application/json" },
} as const;

const app = express();
app.disable("x-powered-by");
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || LOCAL_ORIGIN.test(origin)),
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "melody-rain-local", version: appVersion });
});

app.get("/api/demo/manifest", (_request, response) => {
  response.json({
    title: "Ode to Joy (Easy variation)",
    folderName: "sample/ode-to-joy",
    assets: Object.entries(demoAssets).map(([key, asset]) => ({
      key,
      name: asset.file,
      url: `/api/demo/${key}`,
    })),
  });
});

app.get("/api/demo/:asset", (request, response) => {
  const key = request.params.asset as keyof typeof demoAssets;
  const asset = demoAssets[key];
  if (!asset) {
    response.status(404).json({ code: "DEMO_ASSET_NOT_FOUND" });
    return;
  }
  response.type(asset.contentType).sendFile(path.join(demoRoot, asset.file));
});

app.post("/api/export/jobs", upload.any(), async (request, response) => {
  try {
    const files = (request.files as Express.Multer.File[] | undefined) ?? [];
    const required = ["score", "midi", "audio"];
    if (required.some((field) => !files.some((file) => file.fieldname === field))) {
      response.status(400).json({ code: "EXPORT_ASSETS_MISSING" });
      return;
    }
    const quality: ExportQuality = request.body.quality === "standard" ? "standard" : "high";
    const startFrame = Number(request.body.startFrame);
    const endFrame = Number(request.body.endFrame);
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame < 0 || startFrame >= endFrame) {
      response.status(400).json({ code: "EXPORT_FRAME_RANGE_INVALID" });
      return;
    }
    const requestOrigin = request.get("origin");
    if (requestOrigin && !LOCAL_ORIGIN.test(requestOrigin)) {
      response.status(403).json({ code: "EXPORT_ORIGIN_DENIED" });
      return;
    }
    const appUrl = requestOrigin || `http://${host}:${port}`;
    if (activeExportJobs >= MAX_CONCURRENT_EXPORT_JOBS) {
      response.status(503).json({ code: "EXPORT_CONCURRENCY_LIMIT" });
      return;
    }
    const job = await createExportJob(exportRoot, files, quality, { startFrame, endFrame });
    activeExportJobs += 1;
    response.status(202).json(exportJobStatus(job));
    // Render the export from the same origin the user is on: in dev the page
    // comes from the Vite server (live code), while this host may serve a
    // stale dist/ build. The origin is validated against the CORS allowlist
    // so the headless browser cannot be redirected to an arbitrary URL.
    void runExportJob(job, appUrl)
      .catch((error: unknown) => {
        console.error("Export job failed unexpectedly / 导出任务意外失败:", error instanceof Error ? error.message : String(error));
      })
      .finally(() => { activeExportJobs -= 1; });
  } catch (error) {
    response.status(500).json({ code: "EXPORT_CREATE_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/export/jobs/:id", (request, response) => {
  const job = exportJob(request.params.id);
  if (!job) { response.status(404).json({ code: "EXPORT_JOB_NOT_FOUND" }); return; }
  response.json(exportJobStatus(job));
});

app.get("/api/export/jobs/:id/manifest", (request, response) => {
  const job = exportJob(request.params.id);
  if (!job) { response.status(404).json({ code: "EXPORT_JOB_NOT_FOUND" }); return; }
  response.json(exportJobManifest(job));
});

app.get("/api/export/jobs/:id/assets/:index", (request, response) => {
  const job = exportJob(request.params.id);
  const asset = job?.assets[Number(request.params.index)];
  if (!job || !asset) { response.status(404).json({ code: "EXPORT_ASSET_NOT_FOUND" }); return; }
  response.type(asset.contentType).sendFile(asset.path);
});

app.get("/api/export/jobs/:id/result", (request, response) => {
  const job = exportJob(request.params.id);
  if (!job) { response.status(404).json({ code: "EXPORT_JOB_NOT_FOUND" }); return; }
  if (job.phase !== "completed") { response.status(409).json({ code: "EXPORT_NOT_COMPLETED" }); return; }
  response.download(job.outputPath, "melody-rain.mp4");
});

app.delete("/api/export/jobs/:id", async (request, response) => {
  const job = exportJob(request.params.id);
  if (!job) { response.status(404).json({ code: "EXPORT_JOB_NOT_FOUND" }); return; }
  if (job.phase === "queued" || job.phase === "rendering") {
    await cancelExportJob(job);
    response.status(202).json(exportJobStatus(job));
    return;
  }
  await removeExportJob(job);
  response.status(204).end();
});

app.use(express.static(webRoot));
app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api/")) {
    next();
    return;
  }
  response.sendFile(path.join(webRoot, "index.html"));
});

app.use((_request, response) => {
  response.status(404).json({ code: "NOT_FOUND" });
});

app.listen(port, host, () => {
  console.log(`MelodyRain local service: http://${host}:${port}`);
});
