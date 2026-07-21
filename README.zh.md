# MelodyRain

[简体中文](./README.zh.md) | [English](./README.md)

MelodyRain 是一个本地优先的五线谱演奏动画工具。它读取 MusicXML/MXL、MIDI 和 MP3，用同一个时间轴驱动音频播放、谱面滚动、音符下落与命中效果，并支持把谱面和演奏元素显示为背景图片或颜色的蒙版。

当前版本支持浏览器内的竖屏预览与本地 MP4 视频导出。

## 🎬 演示视频

![Melody Rain Preview](./src/assets/introduction.gif)

[▶ 在 YouTube 观看完整演示](https://youtu.be/E06tpN6sOag)

## Codex 与 GPT-5.6 的使用方式

GPT-5.6 通过 Codex 参与了 Melody Rain 的完整创作过程，是项目开发期间使用的主要 AI 模型。它帮助我将最初的情感构想转化为产品规格和技术规格，起草并持续维护 README，设计项目架构，生成并重构了所有的 React、TypeScript、SCSS、Express、Playwright 与 FFmpeg 相关代码，编写测试、诊断问题，并持续迭代同步机制、动画、UI 和视频导出行为。GPT-5.6 在本项目中扮演的是开发协作者，而不是嵌入 Melody Rain 的运行时模型；用户预览或导出演奏视频时，应用目前不会调用 OpenAI API。

## 环境要求

- Node.js `>=20.19 <27`
- npm
- FFmpeg，且 `ffmpeg` 可通过系统 `PATH` 调用
- 推荐使用最新版 Chrome 或 Edge。支持 File System Access API 时，应用可以记住素材文件夹并直接把参数写回其中；其他浏览器会退回到文件夹选择和 JSON 下载。

## 快速开始

安装依赖并启动开发服务：

```powershell
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 开发服务器会把 `/api` 请求代理到运行于 `127.0.0.1:4174` 的本地 Express 服务。

应用应该已经加载了 "ode-to-joy" 样例，直接点击“播放”即可开始播放。如果样例没有加载，点击 **素材文件夹 / SOURCE FOLDER**，选择仓库内的：

```text
sample/ode-to-joy
```

![样例已加载界面](src/assets/readme-sample-loaded.png)

此样例包含：

```text
ode-to-joy-easy-variation.mxl
ode-to-joy-easy-variation.mid
ode-to-joy-easy-variation.mp3
ode-to-joy-easy-variation.pdf
melody-rain.settings.json
```

应用会使用前三个同名文件建立项目，并自动读取参数文件。PDF 仅作为原始乐谱参考，不参与程序加载。样例参数会显示纯色背景、两小节一行和彩虹色演奏元素。

素材解析和谱面排版完成、页面显示 **Score, MIDI, and audio are ready / 谱面、MIDI 与音频已就绪** 后，即可点击播放。

## 功能概览

- 使用 OpenSheetMusicDisplay 渲染 SVG 五线谱；
- 自动匹配素材文件夹内同名的 MXL/MusicXML、MIDI 和 MP3；
- 播放、暂停、回到开头、进度跳转和 `0.9×`、`0.95×`、`1×` 变速；
- 预览区显示与导出时间轴一致的当前帧号；通过本地 Chrome 逐帧渲染，并由 FFmpeg 导出 30 FPS、H.264/AAC MP4 视频，支持帧范围、普通/高清质量、进度显示与取消；
- 音符、和弦、休止符及相关记谱元素随演奏下落、命中并停留；
- 谱面采用三阶段纵向相机：当前谱表行到达画面中线前静止，随后居中跟随当前谱表行；谱尾完整显示后提前停止，尾声自然向画面下方推进；
- 谱面结构使用固定背景源蒙版，可选择图片或纯色，并调节黑色混入和谱纸透明度；
- 演奏元素可选择“共用蒙版”或 C–B 彩虹配色；
- 共享连杆音符可选择“一并落下”或首音落地后随 note-on 从左向右展开；
- 标题支持自动对比色和自定义颜色；
- 每行小节数可在 1–6 之间调整；
- 项目参数可保存为 `melody-rain.settings.json`，再次载入素材文件夹时自动恢复。

## 视频导出

导出由本地 Express 服务创建任务，Playwright 驱动本机 Chrome 或 Edge 按绝对时间逐帧渲染，PNG 帧通过管道直接交给 FFmpeg，与素材 MP3 一起封装为 H.264/AAC MP4。预览和导出共用同一个 Transport、谱面相机和动画状态计算。

- 普通质量默认输出 `540 × 960`、30 FPS，并使用更快的编码预设；
- 高清质量输出 `1080 × 1920`、30 FPS；
- 默认导出全曲，也可输入包含起始帧、不包含结束帧的局部范围；帧号包含 1.2 秒音符入场预卷，第 36 帧对应乐曲时间 0；
- 支持任务进度、取消和错误提示；服务端限制最大并发数并校验 Origin 头；
- 音频同步使用 FFmpeg `adelay` 滤镜填充真实静音，避免部分手机播放器因忽略 MP4 edit list 而出现音画不同步；
- 默认文件名取当前画面标题，并自动替换 Windows 文件名非法字符；
- 浏览器具有素材文件夹写入权限时，视频直接保存到素材文件夹；否则回退到浏览器下载目录；
- 保存完成后弹窗通知文件名和保存方式。

开发环境必须使用 `npm run dev` 同时启动 Vite 和本地导出服务。只运行 `npm run dev:web` 时，导出 API 不可用。

未读取项目参数文件时，视觉参数默认使用：谱面黑色混入 `40%`、谱纸透明度 `10%`、演奏蒙版混入 `50%`。

## 准备自己的素材

一个素材文件夹至少需要：

- 一份乐谱：`.mxl`、`.musicxml` 或 `.xml`；
- 一份 MIDI：`.mid` 或 `.midi`；
- 一份音频：`.mp3`。

建议三者使用相同的主文件名，例如：

```text
my-song.mxl
my-song.mid
my-song.mp3
```

也可以加入 `.png`、`.jpg`、`.jpeg`、`.webp` 或 `.avif` 背景图片，以及一个 `melody-rain.settings.json` 参数文件。若三类必需素材各自只有一个候选，即使文件名不同也可以载入；存在多组且无法唯一匹配时，应用会停止并提示错误。

MusicXML、MIDI 和 MP3 应来自同一份乐谱及同一次导出，否则音符动画可能无法正确对应音频。

## 参数保存与读取

点击 **保存参数**（Save Settings）会保存以下设置：

- 标题、标题颜色及自动/自定义模式；
- 每行小节数；
- 背景模式、颜色或图片文件名；
- 谱面蒙版黑色混入和谱纸透明度；
- 演奏元素模式、混入颜色和混入强度。
- 共享连杆音符模式。
- 帧范围着色的 60 帧过渡及自定义范围。

**NOTE FRAME EFFECT / 音符帧效果** 统一管理共享混入强度和帧范围着色。首次载入时自动建立从第 1 帧到最后一帧的 `Range 1`。单色范围恢复为共用谱面背景源并按混入强度叠加颜色；彩虹范围不使用该强度。范围结束或范围之间存在空档时，沿用最近一个范围的设置，直到下一个范围接管或视频结束。所有颜色边界都按绝对帧号经 60 帧平滑过渡，包括单色与彩虹色之间的模式切换（经彩虹渲染逐色插值，过渡结束才切换渲染器）。

文件名固定为 `melody-rain.settings.json`。浏览器具有素材文件夹写入权限时会直接保存到该文件夹；否则浏览器会下载文件，需要手动将它放回素材文件夹。点击 **读取参数**（Load Settings）可重新应用已发现的参数文件，或另行选择 JSON 文件。

当前开发格式为 v5，只读取当前版本。完整且可编辑的默认配置可参考 `sample/ode-to-joy/melody-rain.settings.json`；其中包含可直接读取的 `noteFrameEffect` 混入强度和至少一个从第 1 帧开始的范围。

应用首次启动且没有已记住的用户素材文件夹时，会自动加载 `sample/ode-to-joy`，包括乐谱、MIDI、MP3、背景图片和默认设置。用户选择并授权自己的素材文件夹后，后续刷新优先恢复用户文件夹，不再自动覆盖为示例项目。

## 生产构建

```powershell
npm run build
npm start
```

然后打开 <http://127.0.0.1:4174>。

## 开发与验证

```powershell
npm run typecheck
npm test
npm run build
npm run deps:check
```

主要代码位于：

```text
src/components/   页面控制、播放信息与舞台
src/hooks/        素材文件夹加载流程
src/lib/          乐谱、MIDI、时间轴、相机、蒙版与动画层
src/server/       本地生产服务
```

更完整的产品规则和技术设计见 [MelodyRain_Product_Technical_Spec_v0.1.md](./MelodyRain_Product_Technical_Spec_v0.1.md)。

## 当前边界

- 视频导出要求本机安装 Chrome 或 Edge，并确保可通过 `PATH` 调用 FFmpeg；
- 当前导出采用逐帧浏览器截图，速度明显慢于实时播放；
- 音频直接使用素材中的 MP3，没有接入 SoundFont/FluidSynth 合成；
- MusicXML 与 MIDI 使用现有谱面目标进行匹配，尚未提供正式的对齐置信度报告和人工校正界面；
- 当前仅提供 9:16 竖屏舞台，不提供横屏布局；
- 浏览器不会读取任意本地路径，必须由用户选择并授权素材文件夹。

## 推荐配色

以下颜色适合作为纯色背景、标题文字或彩虹演奏元素的配色：

| 颜色 | 色块                                                                                                                            | HEX       | HSL            |
| :- | :---------------------------------------------------------------------------------------------------------------------------- | :-------- | :------------- |
| 赤  | <span style="display:inline-block;width:24px;height:24px;background:#E84A4A;border-radius:4px;vertical-align:middle;"></span> | `#E84A4A` | 0°, 80%, 52%   |
| 橙  | <span style="display:inline-block;width:24px;height:24px;background:#E88A2A;border-radius:4px;vertical-align:middle;"></span> | `#E88A2A` | 30°, 82%, 54%  |
| 黄  | <span style="display:inline-block;width:24px;height:24px;background:#E8C420;border-radius:4px;vertical-align:middle;"></span> | `#E8C420` | 48°, 78%, 52%  |
| 绿  | <span style="display:inline-block;width:24px;height:24px;background:#50C850;border-radius:4px;vertical-align:middle;"></span> | `#50C850` | 120°, 75%, 55% |
| 青  | <span style="display:inline-block;width:24px;height:24px;background:#1CAEE8;border-radius:4px;vertical-align:middle;"></span> | `#1CAEE8` | 197°, 82%, 51% |
| 蓝  | <span style="display:inline-block;width:24px;height:24px;background:#2A7AE8;border-radius:4px;vertical-align:middle;"></span> | `#2A7AE8` | 220°, 80%, 53% |
| 紫  | <span style="display:inline-block;width:24px;height:24px;background:#8A4AE8;border-radius:4px;vertical-align:middle;"></span> | `#8A4AE8` | 270°, 78%, 60% |
| 粉  | <span style="display:inline-block;width:24px;height:24px;background:#E84AA0;border-radius:4px;vertical-align:middle;"></span> | `#E84AA0` | 330°, 78%, 60% |
