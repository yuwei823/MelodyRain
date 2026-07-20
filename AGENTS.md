# AGENTS.md

本文件帮助代码模型快速理解 MelodyRain 的结构、约定与常见坑。

## 项目是什么

MelodyRain 是一个本地优先的五线谱演奏动画工具：读取 MusicXML/MXL + MIDI + MP3，
用同一条时间轴驱动音频播放、谱面纵向滚动、音符下落与命中效果，并把 9:16 竖屏
画面通过本机 Chrome 逐帧渲染、FFmpeg 封装导出为 30 FPS 的 H.264/AAC MP4。

## 技术栈

- 前端：React 19 + TypeScript + Vite 8 + SCSS（sass），OpenSheetMusicDisplay 2.0 渲染 SVG 谱面，@tonejs/midi 解析 MIDI
- 服务端：Express 5 + multer（上传）+ playwright-core（驱动本机 Chrome/Edge）+ FFmpeg（外部进程）
- 测试：vitest 4 + jsdom，测试与源码同目录（`*.test.ts`，DOM 测试用 `*.dom.test.ts` 命名）

## 常用命令

- `npm run dev` — 必须用它同时起 Vite（5173，热更新）和导出服务（4174）；只起 `dev:web` 时导出 API 不可用
- `npm test` / `npm run typecheck` — 改动后至少跑这两个
- `npm run build` — typecheck + `vite build`（→ dist/）+ `tsc -p tsconfig.server.json`（→ dist-server/server/）
- `npm start` — 运行 `node dist-server/server/index.js`（生产模式服务 dist/）

## 目录结构

- `src/lib/` — 纯逻辑层，尽量保持无 React 依赖；核心文件：
  - `transport.ts` — 媒体 transport 与 `TransportSnapshot`，导出 `TRANSPORT_PRE_ROLL_MS = 1200`
  - `midi.ts` — MIDI 解析与 `MidiTimeline`（时间 ↔ scoreQuarter 换算）
  - `score-renderer.ts` — OSMD 排版，产出落点 targets / 休止符 / reveal 元素
  - `score-camera.ts` — 纵向相机（见下）
  - `rain-layer.ts` — 音符/休止符下落动画，MIDI 事件 ↔ SVG 落点匹配
  - `performance-effect-layer.ts` — 演奏元素的蒙版/彩虹着色（fixed 背景源）
  - `score-mask-layer.ts` / `score-timeline-layer.ts` — 谱面蒙版、时间线揭示
  - `frame-color-ranges.ts` — 帧范围着色与过渡计算
  - `video-export.ts` — **前后端共享**的导出常量与帧数公式（见"常见坑"）
  - `project-settings.ts` — `melody-rain.settings.json` 的序列化/校验
  - `render-profile.ts` — 竖屏渲染 profile（1080×1920，fps 必须与导出一致）
- `src/hooks/` — React 组装层：`use-score-stage.ts` 是渲染编排中枢（创建/更新各 layer 与相机），
  `use-media-transport.ts` 播放控制，`use-project-loader.ts` 素材文件夹加载与设置持久化，
  `use-project-visual-settings.ts` 所有可视化参数的状态与导入导出
- `src/components/` — UI：`control-panel` / `playback-panel` / `stage-panel` / `export-card` / `frame-color-range-control`
- `src/server/` — 本地服务：`index.ts`（Express 路由）、`video-export.ts`（导出任务生命周期）
- `sample/ode-to-joy/` — 内置示例素材（欢乐颂）

## 核心领域概念

- **时间轴**：`sourceTimeMs` 是乐曲时间（含负值预滚）；presentation 时间 = sourceTime + 1200ms 预滚。
  第 36 帧对应乐曲时间 0。任何新时间概念都要与 `TRANSPORT_PRE_ROLL_MS` 对齐。
- **scoreQuarter**：谱面位置单位（四分音符数），由 `MidiTimeline` 在时间轴与谱面间换算，相机和图层都以它为准。
- **纵向相机**（`score-camera.ts`）：纯函数 `systemFollowingCameraOffset` 根据锚点把音符聚成"行"，
  输出让当前行垂直居中的偏移；换行过渡用 smoothstep，时长由 `SCORE_SYSTEM_TRANSITION_QUARTERS` 控制。
  它是 `scoreQuarter` 的纯函数——导出逐帧渲染依赖这种确定性，修改时必须保持。
  偏移经 CSS 变量 `--score-camera-offset-y` 应用到 `.score-host`，`PerformanceEffectLayer.update()` 也读它做蒙版对齐，两者要一起考虑。
- **帧模型**：导出固定 30 FPS；帧范围内部为 0 基、end 排除，UI（FrameColorRangeControl/PlaybackPanel）显示为 1 基。
- **图层更新**：播放中 transport 订阅每帧调 `useScoreStage.update()`（rain/timeline/camera/effect），
  UI 快照单独按 50ms 节流发布。热路径上避免每帧分配/排序/JSON 比较。
- **连音符模式**切换不重排 OSMD，只重跑 `rainLayer.setEvents` + 更新 effect visuals。

## 视频导出链路

1. 前端 POST `/api/export/jobs`（multer 上传 score/midi/audio/背景/设置）
2. 服务端 `runExportJob`：playwright-core 启动本机 Chrome/Edge → 打开 `<appUrl>/?exportJob=<id>`
3. 页面加载素材后暴露 `window.__MELODY_RAIN_EXPORT__.renderFrame(timeMs)` 并置 `documentElement.dataset.exportReady`
4. 服务端逐帧调用 renderFrame → 截图 `.portrait-frame` → PNG 管道写入 FFmpeg stdin → 与 MP3 一起封装 MP4
5. 任务支持进度查询、取消（DELETE）；失败/取消的任务 10 分钟后自动清理，服务启动时清理上次残留

## 常见坑（改动前必读）

- **双 tsconfig**：`tsconfig.json`（Bundler 解析，覆盖全部 src，noEmit）+ `tsconfig.server.json`
  （NodeNext，rootDir=src，输出 dist-server/server/）。被服务端 import 到的 `src/lib` 文件，
  其相对 import 必须带 `.js` 扩展名（如 `transport.ts` 里 `from "./midi.js"`）。
- **共享常量**：预滚/帧率/帧数公式只维护一份，在 `src/lib/video-export.ts`
  （`VIDEO_EXPORT_FPS`、`VIDEO_EXPORT_PRE_ROLL_MS`、`videoExportFullFrameCount`），
  服务端经 `../lib/video-export.js` 引用。改帧率必须同时考虑 `render-profile.ts` 的展示值。
- **导出渲染来源**：导出页 URL 取请求的 Origin——dev 下是 Vite（实时代码），生产下是 4174 的 dist/。
  因此**生产模式改代码后必须 `npm run build`**，否则导出视频用的还是旧 bundle。
- **编码**：部分源文件含历史乱码的中英双语文案（UTF-8 但内容是早期双重编码残留）。
  编辑这些文件不要用 PowerShell 的默认编码读写，会破坏 UTF-8；新文案用正常中文即可。
- **双语 UI**：界面文案惯例为 `English / 中文` 形式。
- **FFmpeg/Chrome 依赖**：导出需要系统 PATH 里有 `ffmpeg`，以及本机 Chrome 或 Edge
  （可用 `MELODY_RAIN_CHROME` 环境变量指定路径）。
- **promise 纪律**：服务端凡是可能被取消/中途失败的进程 promise（如 waitForProcess），
  创建时必须保证不会 unhandled rejection，否则整个本地服务进程会崩溃。

## 测试约定

- 纯逻辑（相机、帧范围、transport、序列化等）必须有 vitest 单测；改行为先改测试预期再实现。
- DOM 相关（rain-layer、performance-effect-layer）用 jsdom，`*.dom.test.ts` 命名。
- `score-renderer.integration.test.ts` 用真实 OSMD 跑排版，较慢，改动排版逻辑时必须跑。
- 验证标准：`npm run typecheck && npm test` 全绿后再提交。
