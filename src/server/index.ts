import cors from "cors";
import express from "express";
import path from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.MELODY_RAIN_PORT ?? 4174);
const projectRoot = process.cwd();
const demoRoot = path.join(projectRoot, "ode-to-joy");
const webRoot = path.join(projectRoot, "dist");

const demoAssets = {
  score: { file: "ode-to-joy-easy-variation.mxl", contentType: "application/vnd.recordare.musicxml" },
  midi: { file: "ode-to-joy-easy-variation.mid", contentType: "audio/midi" },
  audio: { file: "ode-to-joy-easy-variation.mp3", contentType: "audio/mpeg" },
} as const;

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "melody-rain-local", version: "0.1.0" });
});

app.get("/api/demo/manifest", (_request, response) => {
  response.json({
    title: "Ode to Joy (Easy variation)",
    assets: Object.fromEntries(
      Object.keys(demoAssets).map((key) => [key, `/api/demo/${key}`]),
    ),
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
