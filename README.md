# MelodyRain

[简体中文](./README.md) | [English](./README.en.md)

MelodyRain 是一个本地优先的五线谱演奏动画工具。它读取 MusicXML/MXL、MIDI 和 MP3，用同一个时间轴驱动音频播放、谱面滚动、音符下落与命中效果，并支持把谱面和演奏元素显示为背景图片或颜色的蒙版。

当前版本专注于浏览器内的竖屏预览，尚不导出视频。

## 功能概览

- 使用 OpenSheetMusicDisplay 渲染 SVG 五线谱；
- 自动匹配素材文件夹内同名的 MXL/MusicXML、MIDI 和 MP3；
- 播放、暂停、回到开头、进度跳转和 `0.5×`、`0.75×`、`1×` 变速；
- 音符、和弦、休止符及相关记谱元素随演奏下落、命中并停留；
- 谱面随当前系统纵向滚动；
- 谱面结构使用固定背景源蒙版，可选择图片或纯色，并调节黑色混入和谱纸透明度；
- 演奏元素可选择“共用蒙版”或 C–B 彩虹配色；
- 标题支持自动对比色和自定义颜色；
- 每行小节数可在 1–6 之间调整；
- 项目参数可保存为 `melody-rain.settings.json`，再次载入素材文件夹时自动恢复。

未读取项目参数文件时，视觉参数默认使用：谱面黑色混入 `40%`、谱纸透明度 `10%`、演奏蒙版混入 `50%`。

## 环境要求

- Node.js `>=20.19 <27`
- npm
- 推荐使用最新版 Chrome 或 Edge。支持 File System Access API 时，应用可以记住素材文件夹并直接把参数写回其中；其他浏览器会退回到文件夹选择和 JSON 下载。

## 快速开始

安装依赖并启动开发服务：

```powershell
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 开发服务器会把 `/api` 请求代理到运行于 `127.0.0.1:4174` 的本地 Express 服务。

在页面中点击“选择素材文件夹”，选择仓库内的：

```text
sample/ode-to-joy
```

此样例包含：

```text
ode-to-joy-easy-variation.mxl
ode-to-joy-easy-variation.mid
ode-to-joy-easy-variation.mp3
ode-to-joy-easy-variation.pdf
melody-rain.settings.json
```

应用会使用前三个同名文件建立项目，并自动读取参数文件。PDF 仅作为原始乐谱参考，不参与程序加载。样例参数会显示纯色背景、两小节一行和彩虹色演奏元素。

素材解析和谱面排版完成、页面显示“谱面、MIDI 与音频已就绪”后，即可点击播放。

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

控制栏中的“保存参数”会保存以下设置：

- 标题、标题颜色及自动/自定义模式；
- 每行小节数；
- 背景模式、颜色或图片文件名；
- 谱面蒙版黑色混入和谱纸透明度；
- 演奏元素模式、混入颜色和混入强度。

文件名固定为 `melody-rain.settings.json`。浏览器具有素材文件夹写入权限时会直接保存到该文件夹；否则浏览器会下载文件，需要手动将它放回素材文件夹。点击“读取参数”可重新应用已发现的参数文件，或另行选择 JSON 文件。

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

- 目前只提供浏览器内预览，没有 MP4/FFmpeg 导出；
- 音频直接使用素材中的 MP3，没有接入 SoundFont/FluidSynth 合成；
- MusicXML 与 MIDI 使用现有谱面目标进行匹配，尚未提供正式的对齐置信度报告和人工校正界面；
- 当前仅提供 9:16 竖屏舞台，不提供横屏布局；
- 浏览器不会读取任意本地路径，必须由用户选择并授权素材文件夹。
