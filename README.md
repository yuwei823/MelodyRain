# MelodyRain

本地优先的五线谱动画工具。当前第一阶段已经可以加载 MXL、MIDI 与 MP3，以 OSMD 渲染 SVG 五线谱，并通过单一 Transport 同步音频、进度、有效 BPM、音乐逻辑位置和当前 MIDI 音符。

## 开发运行

```powershell
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。本地 Express 服务运行在 `127.0.0.1:4174`，Vite 会把 `/api` 请求代理到该服务。

页面默认加载 `ode-to-joy` 目录中的示例素材，也可以在页面中选择本地 MXL/MusicXML、MIDI 和 MP3。

## 验证

```powershell
npm run deps:check
npm test
npm run typecheck
npm run build
```

生产构建完成后运行：

```powershell
npm start
```

并打开 <http://127.0.0.1:4174>。

## 当前边界

- 已实现：MXL 安全路径校验与解析、MusicXML 摘要、MIDI note/tempo 解析、OSMD SVG、MP3 Transport、播放/暂停/跳转/速度切换、活动音符显示。
- 已保留但未接入界面：雨滴原型层。
- 尚未实现：MusicXML/MIDI 正式置信度对齐、原始 notehead 隐藏、雨滴与发光、纵向系统滚动、FluidSynth 和 FFmpeg 视频导出。
