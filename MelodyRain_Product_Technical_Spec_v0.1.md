# MelodyRain 产品与技术规格说明书

**版本：** v0.1  
**状态：** Draft  
**日期：** 2026-07-17  
**示例来源：** https://musescore.com/user/28854994/scores/11566147  
**MVP-1 目标：** 在本地网页应用中导入用户预先下载的 MusicXML 与 MIDI，生成可播放五线谱和带同步音乐的竖屏动画视频。

---

## 1. 产品定义

MelodyRain 将 MusicXML 与 MIDI 转换为可播放的数字五线谱，并进一步生成“音符从上方落下，在奏响时停留于原谱对应音符位置，同时发光、变色”的动画视频。产品直接采用竖屏方案；MVP-1 唯一输出画幅为 1080×1920、9:16，不开发横屏方案。

产品的核心不是把 MIDI 画成普通钢琴卷帘，而是保留五线谱的谱号、调号、拍号、声部、连线、符干、横梁与小节排版，并让动画音符与实际播放逐音同步。

### 1.1 成功标准

给定用户从同一 MuseScore 乐谱手工下载到本地的 MusicXML 与 MIDI，无需手工标注音符坐标，即可得到：

1. 可在浏览器中播放、暂停和跳转的五线谱预览；
2. 与预览一致的合成音乐；
3. 1080p、60 fps、带音频的 MP4 动画；
4. 每个可演奏音符在其发声时刻到达对应谱面音符头的位置；
5. 音符命中后产生闪光和颜色变化。

### 1.2 目标用户

- 需要批量制作音乐可视化内容的创作者；
- 需要制作钢琴教学、识谱或音乐欣赏视频的用户；
- 需要通过配置模板重复生成统一风格视频的工作室。

---

## 2. 范围

### 2.1 MVP-1 范围

- 以本地网页应用运行，不依赖服务端；
- 用户手工选择本地 MusicXML/MXL 与 MIDI 文件；
- 支持钢琴独奏谱，包含高音谱表和低音谱表；
- 渲染一行或多行五线谱；
- 合成可正确播放的音乐；
- 支持播放、暂停、跳转和进度显示；
- 生成 `rainDrop + glow + colorize` 三种全局效果；
- 整首乐曲使用同一套效果配置，不支持逐小节编辑；
- 支持竖屏 9:16，生成 1080×1920、60 fps、H.264/AAC MP4；
- 允许根据屏幕尺寸手动设置每行乐谱包含的小节数；
- 修改每行小节数后实时更新五线谱排版预览；
- 生成结构化中间产物，支持断点重跑和问题诊断。

### 2.2 MVP-1 不包含

- 自动打开 MuseScore、自动下载 MusicXML/MIDI 或处理登录状态；
- 从任意音频自动转写为五线谱；
- 仅凭 MIDI 还原出版级五线谱排版；
- 修改或编辑原始乐谱；
- 多人协作、云端队列、付费与账号系统；
- 花朵、云彩、彩虹、复杂 3D 粒子等主题特效；
- 逐小节、逐声部或逐音符效果编辑；
- 横屏、方形和自定义画幅；
- 第三方增强音轨导入；
- 对所有管弦乐总谱和特殊现代记谱法提供完整支持。

### 2.3 MVP-2 与后续版本

- 多乐器、总谱和分谱选择；
- 主题粒子、轨迹、背景与镜头模板；
- 更多音符入场方式与基于音乐情绪的自动效果编排；
- 使用第三方 DAW、虚拟乐器或 AI 乐器生成更丰富的替代音轨；
- 更高分辨率的竖屏及其他平台专用竖屏 RenderProfile；
- MuseScore 链接自动获取资源；
- 逐小节效果编辑；
- 批处理、任务队列、云端渲染；
- 4K 与更多平台专用画幅 preset；
- 支持把独立 MIDI 自动转换为简化谱，但需明确标为“自动转谱”。

---

## 3. 关键产品决策

### 3.1 MusicXML 与 MIDI 的职责

| 数据 | 主要职责 | 是否为合格五线谱成品所必需 |
|---|---|---:|
| MusicXML/MXL | 乐谱语义、谱号、调号、拍号、小节、声部、音高、时值、连线和排版输入 | 是 |
| MIDI | 实际播放时序、力度、通道、踏板以及音频合成输入 | 是 |
| PDF | 人工核对原始排版；不作为动画坐标来源 | 否 |
| 音频 | 可选的高质量伴奏；需要额外做时间对齐 | 否 |
| MSCZ | 可选原始工程，用于重新导出 MusicXML/MIDI | 否 |

仅有 MIDI 时，程序可以播放音乐并生成钢琴卷帘，但无法可靠恢复声部、左右手、异名同音、连音线、符干、横梁及人工排版。因此，MVP-1 要求用户导入同一乐谱的 MusicXML 与 MIDI：MusicXML 提供正确谱面，MIDI 提供播放与动画时序。

### 3.2 统一事实来源

- MusicXML 事件是谱面身份的事实来源；
- MIDI 事件是演奏时间和力度的事实来源；
- 渲染器输出的图形对象是屏幕坐标的事实来源；
- 所有动画和音频导出使用同一个离线时间轴，不使用渲染时的系统时钟。

### 3.3 MVP-1 本地资源前提

MVP-1 不实现自动下载。用户先通过 MuseScore 页面手工下载文件，再在本地网页中选择：

1. 一个 `.musicxml`、`.xml` 或 `.mxl` 文件；
2. 一个 `.mid` 或 `.midi` 文件；
3. 两个文件必须来自同一乐谱版本；
4. 文件只在本机处理，默认不上传到任何服务器；
5. 系统验证文件格式和内容一致性后进入解析阶段。

MuseScore URL 自动获取资源属于 MVP-2。本阶段只保留来源 URL 作为可选元数据，不参与下载。

---

## 4. 用户流程

1. 用户在 MuseScore 手工下载同一乐谱的 MusicXML/MXL、MIDI 与 MP3；
2. 用户打开本地网页应用并选择包含这三类资源的文件夹；
3. 系统在本地校验文件格式和内容一致性；
4. 系统解析、对齐并生成可播放五线谱预览；
5. 用户在预览中调整每行小节数、雨滴、发光和颜色属性；
6. 每次修改布局后，页面实时重新排谱并显示预览；
7. 用户启动本地视频渲染；
8. 用户下载竖屏 MP4 与质量报告。

### 4.1 任务状态

```text
CREATED
  -> SELECTING_LOCAL_FILES
  -> VALIDATING
  -> NORMALIZING
  -> PREVIEW_READY
  -> RENDERING
  -> VERIFYING
  -> COMPLETED | FAILED
```

状态在当前本地会话中持久化。失败后从最近成功阶段继续，不重复解析未变化的源文件。

---

## 5. 功能需求

### FR-01 本地网页应用

- 应用通过本地地址在现代桌面浏览器中打开；
- MusicXML、MIDI、预览缓存和渲染中间数据默认只保留在本机；
- 应用不得要求用户创建账号或连接云端服务；
- 来源 MuseScore URL 是可选元数据，不是 MVP-1 的运行输入。

### FR-02 本地文件选择与校验

- 用户选择一个本地素材文件夹；应用递归读取用户授权的文件夹内容，并自动匹配 MusicXML/MXL、MIDI 与 MP3；浏览器只能取得相对路径（`webkitRelativePath`），不得要求或存储绝对磁盘路径；
- 支持 `.musicxml`、`.xml`、`.mxl`、`.mid`、`.midi`、`.mp3`；
- 优先选择三个同名主文件名的文件；若只有每类各一个候选，则允许名称不同但作为同一组资源载入；若缺少任一格式、多组同名资源并存或无法形成唯一组合，必须在载入前显示明确错误，不得猜测；
- 三个文件必须来自同一份乐谱和同一导出版本；
- PDF 和 MSCZ 不属于 MVP 必需资源；
- 不得仅凭扩展名判断格式，必须校验 MIME、文件签名和实际可解析性；
- 对每个文件计算 SHA-256；
- MXL 必须安全解压，阻止路径穿越和异常压缩比；
- 对文件大小、音符数和时长设置可配置上限；
- MusicXML 与 MIDI 不一致时中止并输出差异摘要，不静默猜测。
- 解析前必须从 MusicXML 中移除所有延音踏板图形和播放控制（`pedal`、`damper-pedal`、`sostenuto-pedal`、`soft-pedal`）；这项全局规则不影响音频文件本身，也不得删除连音线、延音线或其他非踏板记号。

### FR-03 乐谱解析与规范化

输出统一的 `score-model.json`，至少包含：

- 乐曲、乐器、谱表、声部、小节信息；
- 谱号、调号、拍号、速度及速度变化；
- 音符、和弦、休止符、装饰音、连音线；
- 反复、跳房子、D.C./D.S./Coda 展开后的播放顺序；
- 每个音符稳定的 `scoreEventId`；
- 以四分音符为单位的逻辑位置和以秒为单位的播放位置。

稳定 ID 建议组成：

```text
partId/staffId/measureId/voiceId/beat/pitch/occurrence
```

### FR-04 MIDI 时间轴解析

- 正确处理 tempo meta event、ticks-per-quarter-note 与变速；
- 正确处理 `note_on velocity=0` 为 `note_off`；
- 同一音高重叠发声时不得用单值字典覆盖，必须按通道和音高维护队列或栈；
- 解析力度、通道、Program Change、延音踏板 CC64；
- 输出每个演奏事件的开始时间、按键结束时间、踏板释放后的听觉结束时间。

### FR-05 MusicXML/MIDI 对齐

对齐优先使用同一导出版本中的结构位置，而不是仅按“音高 + 排序序号”匹配。

匹配键至少考虑：

- part / instrument；
- staff / voice；
- 展开后的 measure / beat；
- pitch；
- chord index / occurrence；
- tempo-map 转换后的预期 onset。

系统输出每个匹配的置信度和未匹配事件列表。MVP 合格门槛：

- 可见主旋律/钢琴音符匹配率 ≥ 99.5%；
- 低置信度或未匹配音符不得被错误动画，默认标为告警并隐藏其下落层；
- 若整体匹配率低于门槛，预览标记为不可导出。

### FR-06 五线谱渲染

- 使用 MusicXML 渲染 SVG 五线谱；
- MVP 默认只显示选定的钢琴部；
- 每个可演奏音符必须能映射到一个或多个实际 notehead 图形对象；
- 坐标从渲染器图形模型或带稳定标识的 SVG 元素取得，不依赖脆弱的 CSS 类名猜测；
- 保存音符头中心、边界框、所属系统、谱表和页面；
- 重排版、缩放或切换分辨率后必须重新计算坐标。

### FR-07 可播放中间产物

生成 `preview/index.html`，至少提供：

- 播放、暂停、从头播放；
- 点击进度条跳转；
- 当前时间与总时长；
- 播放速度 0.5×、0.75×、1×；界面同时显示播放光标处的有效 BPM；
- 可用 `-5 BPM` / `+5 BPM` 微调预览速度；该操作在内部转换为全曲 `tempoScale`，不得逐段覆盖原谱 tempo map；
- 当前小节高亮；
- 以小节为单位选择导出起点和终点；默认选中全曲；
- 音量控制；
- 音频加载失败和浏览器自动播放限制提示。

标准音频由规范化 MIDI 通过固定版本的 SoundFont 离线合成为 WAV。这样预览和最终视频具有可重复结果。用户提供外部音频时，必须先完成拍点或锚点对齐，MVP 可不启用该路径。

播放器只允许存在一个主 Transport。音频、进度条、当前小节、雨滴、发光、谱面滚动不得各自维护独立计时器：

- `scoreTime` 表示展开反复与跳转后的音乐逻辑位置；
- `sourceTimeMs` 表示按原谱 tempo map 计算的基准时间；
- `tempoScale` 是临时全局速度倍率，默认 `1.0`；
- `presentationTimeMs` 是预览或视频中的实际时间；无暂停区间时，局部满足 `d(presentationTime) = d(sourceTime) / tempoScale`；
- 预览以 Web Audio 高精度时钟或等价单调时钟为准，`requestAnimationFrame` 只读取当前 Transport 状态并绘图，不作为累计计时来源；
- 跳转后由时间索引二分查找当前 `playbackOccurrence`、小节、系统和活动音符，再一次性重建视觉状态；
- 最终视频不读取墙钟，而是由帧号计算 `presentationTimeMs = frameIndex / fps * 1000`，保证重复导出结果一致。

首音符预卷属于主 Transport 的正式时间段，而不是视觉层单独播放的一段 CSS 动画：

- Transport 位于曲首且尚未播放时，`sourceTimeMs` 必须小于首音符的 `spawnMs`，因此首音符及其附属记号均不可见；
- 用户点击播放后，Transport 进入 `playing`，但音频媒体保持静音或暂停，并从 `sourceTimeMs = -1200` 推进到 `0`；该负时间区间称为首音符静音预卷；
- 预卷按 `sourceTimeMs = min(0, -1200 + elapsedMs × tempoScale)` 推进，所以默认 `1.0×` 的展示时长是 1.2 秒，其他速度下仍与全局 `tempoScale` 保持一致；
- `sourceTimeMs = 0` 的同一 Transport 快照中，首音符到达原谱目标并命中；随后音频必须从媒体时间 `0 ms` 开始播放，不得跳过开头或在命中前发声；
- 浏览器为满足自动播放策略而执行的媒体解锁 `play` / `pause` 事件属于内部准备事件。准备阶段和预卷期间，这些事件不得把 Transport 改回 `idle` / `paused`，不得停止帧循环，也不得取消正在进行的首音下落；
- 用户在预卷期间再次点击播放按钮时取消预卷并返回曲首 `idle`；点击“回到开头”也必须取消预卷、把媒体时间设为 `0`，并重新隐藏首音符；
- 用户从曲首跳转到大于 `0` 的位置时取消预卷并按目标时间重建谱面；从任意位置回到曲首后，下一次播放必须重新执行完整预卷；
- 离线视频导出使用同一负时间预卷区间和同一 `tempoScale` 公式，不得在导出端额外手工延迟音频来近似同步。

若当前光标处原谱有效速度为 `baseBpm`，界面显示 `effectiveBpm = baseBpm × tempoScale`。用户点击 `+5 BPM` 时，以当前光标处 `baseBpm` 反算新的全局 `tempoScale`；因此 accelerando、ritardando、不同段落的 tempo 标记及停顿之间的相对关系保持不变。

变速音频规则：

- 浏览器预览可立即设置媒体播放速率，并优先启用浏览器的保音高能力；音频媒体时钟仍是 Transport 的实时基准；
- 若当前浏览器无法在目标倍率下保音高，界面必须提示，且可要求本地服务重新生成该倍率的预览 WAV；不得静默输出升高或降低音高的正式成品；
- 正式视频导出前，把 `tempoScale` 应用于 MIDI tempo events/事件时间并用 FluidSynth 重新合成 WAV，使乐器音高与音色不因整体变速而被简单拉伸；
- 动画时间轴与正式 WAV 必须由同一份缩放后的时间索引生成，不能仅对 FFmpeg 音频输入使用 `atempo` 后再凭时长猜测同步。

### FR-08 谱面视口与换行

MVP-1 使用连续的“纵向谱面相机”。相机以当前书面音符或休止符的落点为锚点，谱面与所有雨滴共用同一个纵向 transform。

- 当当前落点尚未到达 view 高度的 1/2 时，相机偏移为 0，谱面正常静止显示；
- 当当前落点到达或越过 view 高度的 1/2，且整体乐谱底部尚未进入 view 时，相机连续向上移动，使当前落点保持在 view 的纵向中央；
- 当相机已经显示整体乐谱结尾时，偏移钳制在最大值并停止；此后当前落点随谱面位置自然从中央逐渐向 view 底部移动，直到曲终；
- 预卷、播放、暂停、跳转、倒退、倍速和离线逐帧渲染都必须由同一绝对 Transport 时间重建相机偏移；
- 谱面和正在下落的音符使用同一世界坐标与 camera transform，因此滑动不会破坏雨滴与目标 notehead 的相对关系；
- 当前音符距离画面左右边缘至少保留一个音符头宽度；
- 对于单独一行仍无法完整显示的超长小节，允许该行在演奏期间横向滚动；其他行不随之横向移动；
- 超长小节横向滚动时，当前演奏位置固定在画面水平中央；靠近小节首尾、无法继续居中时，使用边界钳制；
- 横向滚动同样对该行谱面与对应雨滴应用同一 camera transform。

#### FR-08.1 画幅与布局属性

画幅仍由 `RenderProfile` 定义以保留扩展性，但 MVP-1 只启用一个竖屏 profile。产品不提供横屏 profile；多 profile 同时导出属于 MVP-2。

```ts
interface RenderProfile {
  id: string;
  orientation: "portrait";
  width: number;
  height: number;
  fps: number;
  safeArea: { top: number; right: number; bottom: number; left: number };
  scoreScale: number;
  measuresPerSystem: number;
}

```

MVP-1 内置 profile：

| Profile | 画幅 | 默认分辨率 | 默认每行小节数 |
|---|---|---:|---:|
| `portrait-9x16` | 竖屏 9:16 | 1080×1920 | 3 |

`measuresPerSystem` 表示每个谱表系统/每行乐谱的小节数，用户可以修改并立即看到重新排版结果。

`scoreScale` 是 OSMD 的全局排版缩放因子。MVP-1 固定为 `2/3`（配置值 `0.666667`），必须等比例缩放谱号、调号、拍号、五线谱、音符、符干、连杆、附点、加线、文字及其他全部 SVG 记谱元素，不得只缩放音符或雨滴。每次缩放或重新排版后，系统必须从最终 SVG 重新采集音符边界框及雨滴命中坐标，以保证下落、停留和谱面滚动仍与原谱精确对齐。

#### FR-08.2 手动小节排版

- 用户可对整个 profile 设置统一的 `measuresPerSystem`；
- 用户可指定在哪个小节之后强制换行；
- 同一小节不可被拆到两行；跨小节连线允许跨系统显示，但必须保留语义；
- `measuresPerSystem` 是严格目标，系统不得静默改成其他数值；
- 用户修改数值后，应用应在 500 ms 内开始重新排版，并在合理时间内更新预览；
- 若指定的小节数导致符号拥挤，系统显示 `LAYOUT_DENSITY_WARNING`、标出问题系统并给出推荐值；
- 提供由用户主动触发的“自动适配”按钮；只有用户确认后才采用推荐值；
- 若已经出现符号碰撞或音符头小于可读下限，系统禁止正式导出，要求减少每行小节数或使用自动适配。

#### FR-08.3 重排与坐标规则

- 竖屏 RenderProfile 单独执行 MusicXML 重排版，不得先按横屏排版后裁切；
- 每次更改分辨率、安全区、缩放或每行小节数后，必须重新生成 `layout-map.json`；
- `scoreEventId`、MIDI hit time 和效果选择保持不变，只有 system/page 与屏幕坐标改变；
- 入场动画始终以当前 profile 的目标坐标为终点；
- 后续增加其他竖屏分辨率或平台 profile 时，必须重新排谱、重新计算坐标并重新渲染，不得缩放或裁切既有成品代替布局计算。

配置示例：

```yaml
renderProfiles:
  - id: portrait-9x16
    orientation: portrait
    width: 1080
    height: 1920
    fps: 60
    safeArea: { top: 96, right: 72, bottom: 192, left: 72 }
    scoreScale: 0.666667
    measuresPerSystem: 2
```

### FR-09 MVP-1 雨滴入场动画

对每个已匹配音符事件生成一个 `animationEvent`：

```json
{
  "scoreEventId": "P1/S1/M12/V1/2.0/C5/0",
  "startTimeMs": 10500,
  "hitTimeMs": 12000,
  "endTimeMs": 12450,
  "targets": [{ "x": 812.4, "y": 436.8 }],
  "staffId": "P1-S1",
  "velocity": 92,
  "entrance": "rainDrop",
  "entranceProperties": {
    "durationMs": 1200,
    "easing": "easeInCubic",
    "spawnOffsetY": -120
  }
}
```

`rainDrop` 是 MVP-1 唯一入场效果，但仍通过统一接口实现，以便 MVP-2 增加其他入场方式：

```ts
interface EntranceEffect {
  type: string;
  properties: Record<string, number | string | boolean>;
  evaluate(localProgress: number, context: NoteContext): TransformState;
}
```

MVP-1 与 MVP-2 规划：

| `type` | 表现 | 主要 property |
|---|---|---|
| `rainDrop`（MVP-1） | 从上方像雨滴一样落入目标音符 | `durationMs`, `spawnOffsetY`, `easing`, `stretch` |
| `scaleIn`（MVP-2） | 从小到大放大进入 | `durationMs`, `fromScale`, `overshoot`, `easing` |
| `popIn`（MVP-2） | 突然出现，可带轻微过冲 | `durationMs`, `opacityFrom`, `overshoot`, `holdMs` |
| `fadeIn`（MVP-2） | 柔和淡入 | `durationMs`, `opacityFrom`, `easing` |

所有入场效果都必须满足：在 `hitTimeMs` 时准确抵达 `target`，不能因视觉风格改变音乐同步语义。以后增加新的入场方式时，只增加新的 effect type 和 property schema，不修改时间轴核心结构。

`rainDrop` 默认规则：

- `fallDuration = clamp(900ms, 1500ms, 0.75 × beatDuration × 4)`；
- `startTime = hitTime - fallDuration`；
- 起点位于画面上边缘之外，X 坐标与目标音符头中心一致；
- 使用 ease-in 曲线，命中瞬间 Y 坐标等于目标音符头中心；
- 原谱中需要动画的完整记谱单元不直接显示，雨滴是其动画视觉替代；谱号、调号、拍号、普通小节线、五线谱线、大括号和谱表连接线从开始即显示；
- 单音雨滴的目标是原谱 notehead 中心；命中后雨滴停留，直到该谱面行滚出视口；
- 和弦使用一个组合雨滴对象；该对象包含多个目标点，并在同一命中时刻覆盖和弦的全部 notehead 位置；
- 同一音高再次发音时产生新的雨滴，即使先前雨滴仍停留；
- 雨滴颜色由目标谱表决定，而不是根据推断的左右手决定；
- 乐曲未开始且 Transport 位于开头时，第一个音符及其附属记号必须隐藏；
- 点击播放后，主 Transport 先运行默认 1.2 秒静音预卷，首音从画面上方完整下落；到达 `sourceTimeMs = 0` 时首音命中并启动音频，预卷期间不得提前发声；
- 视频导出使用相同预卷语义；首批音符若需要更长入场时间，最多允许 1.5 秒静音预卷；
- 所有书面休止符均生成独立的 `RestVisualGroup`，以其 MusicXML 书面起点映射到主 Transport 的时间作为 `hitTimeMs`，使用与音符相同的 `rainDrop`、谱表颜色、Glow、命中和停留规则；休止符不依赖 MIDI note-on 事件，但必须使用同一 tempo map 换算时间；
- 延音线后的重复图形是否触发由实际 MIDI attack 决定：没有新的 attack 则只延续高亮，不产生第二个雨滴。

#### FR-09.1 完整记谱单元 `NoteVisualGroup`

雨滴不是重新绘制的近似椭圆，而是复用排版引擎生成的完整 SVG 记谱形状。下列属于单音或和弦的元素必须使用相同的动画 transform、颜色、Glow、命中时刻和停留生命周期：

- 符头，包括实心、空心、叉形、菱形、斜线、自定义形状、符头内文字和符头括号；
- 符干、符尾、单音 tremolo 斜线和延长点；
- 实际升降号、还原号、重升/重降、微分音升降号，以及提醒性/编辑性升降号的圆括号或方括号；
- 五线谱外音符所需的全部加线；
- 直接附属于音符的 articulation、ornament、fermata、fingering 和 technical mark；
- 和弦左侧的琶音/禁止琶音符号；
- OSMD/VexFlow 归入该音符 `.vf-stavenote` 或其 modifier 的其他可见记号。

休止符的字形、附点、fermata 以及直接属于该休止符的其他 modifier 组成一个 `RestVisualGroup`，使用同一 transform 整体下落。单音 tremolo 斜线、stroke、ornament 等即使由 VexFlow 渲染为 `.vf-stavenote` 外部的兄弟 SVG 组，也必须根据所属小节、时间位置和横坐标并入对应 `NoteVisualGroup`，不得留在原谱位置。

空心二分音符、全音符及其他空心符头只能改变原有轮廓颜色，不得填满内部空白。和弦的全部符头、共享符干和附属记号组成一个 `NoteVisualGroup`。连续八分、十六分及更短时值音符若共享 beam，则其全部符头、外置符干、多层连杆和 beam hook 合并为一个 `ConnectedNoteVisualGroup`，以组内第一个实际 note-on 作为共同命中时间。加线必须与所属音符共同下落，不能留在原谱位置。

```ts
interface NoteVisualGroup {
  scoreEventIds: string[];
  svgElements: SVGGraphicsElement[];
  staffId: string;
  hitTimeMs: number;
  grouping: "single" | "chord" | "beam" | "grace" | "tuplet" | "tremolo";
}
```

#### FR-09.2 跨音符连接符号的节奏生长

延音线、圆滑线、glissando、slide、颤音延伸线、hammer-on/pull-off 曲线、bend 曲线及其他跨音符连接符不执行下落动画：

1. 第一个音符按 `rainDrop` 正常下落；
2. 第一个音符命中时，连接符号的起点直接出现在原谱位置；
3. 连接符号按照主 Transport，从左向右随节奏生长；
4. 生长进度为 `clamp((timeMs - startTimeMs) / (endTimeMs - startTimeMs), 0, 1)`；
5. 若终止音符只是 tie continuation 且没有新的 MIDI attack，则该终止音符/和弦不重复下落；Transport 到达其书面起点时，完整空心/实心符头、附属记号和加线直接在原谱位置显示；
6. tie continuation 沿用目标谱表颜色和低强度 Glow，保持可见到原 MIDI 事件 release 或所属谱面行滚出视口；
7. 终止音符书面起点到达时连接符号完整显示，此后停留到所属谱面行滚出视口；
8. 实现使用 SVG `clipPath`、mask 或等价的路径裁切，不得通过改变谱面布局宽度实现；
9. 暂停、跳转、倒退和离线逐帧渲染必须能根据绝对 Transport 时间直接重建当前生长比例及 tie continuation 的显隐状态。

#### FR-09.3 谱面说明元素的定时渐显

以下元素初始隐藏，不随音符下落：

- 小节编号；
- 速度记号和节拍器标记；
- 力度记号 `p`、`mf`、`ff` 等；
- 渐强/渐弱发夹；
- 踏板线；
- 八度线 `8va` / `8vb`；
- 乐句文字、表情术语和排练标记；
- 歌词和和弦名称；
- D.C.、D.S.、Coda、Segno；
- 换气号和中断号；
- Volta / 反复房子。

当主 Transport 到达 MusicXML/规范化乐谱模型记录的对应时间位置时，元素在原谱位置执行 `opacity: 0 → 1` 的 300 ms 渐显；不得下落、移动或缩放。渐显完成后保持可见，直到所属谱面行滚出视口。渐强/渐弱发夹、踏板线、八度线和 Volta 到达起始位置时整段渐显，不采用 FR-09.2 的路径生长规则。跳转或倒退后，当前时间之后的元素必须重新隐藏；当前时间之前且已超过 300 ms 渐显区间的元素必须立即恢复为完全可见。

```ts
interface TimedScoreElement {
  svgElementId: string;
  triggerTimeMs: number;
  revealDurationMs: 300;
  reveal: "fade";
}
```

#### FR-09.4 演奏前静态谱面蒙版

演奏前始终可见的静态谱面结构不再直接使用黑色 SVG 绘制，而是作为透明度蒙版显示统一的背景源：

- 蒙版包含谱号、调号、拍号、五线谱线、大括号、谱表连接线，以及普通、双线、终止和反复等全部类型的小节线；
- 音符、休止符、连杆、延音线、说明文字和其他由 FR-09.1 至 FR-09.3 管理的定时元素不得进入该蒙版；
- 浅色谱纸背景保持不变，背景源仅在上述静态谱面几何内部可见；
- 背景源支持纯色或素材文件夹中的 PNG、JPG/JPEG、WebP、AVIF 图片；没有图片时回退为纯黑色 `#000000`；
- 图片使用等价于 CSS `cover` 的居中裁切：按最短边撑满整个谱面视口，保持纵横比，不拉伸；
- 蒙版开口支持 `0%` 至 `100%` 的黑色混入比例；实现为背景源上方、同一蒙版内部的普通黑色透明叠加，默认 `0%`，不得使用结果依赖底层画面的 `mix-blend-mode`；
- 浅色谱纸是背景源之上的独立表面层，支持 `0%` 至 `100%` 的透明度；默认 `0%`（完全不透明），透明度提高时在非蒙版区域显示同一份固定背景源，蒙版开口和黑色混入仍绘制在谱纸上方；
- 图片固定在谱面视口坐标系中，不随整页谱面滚动；蒙版几何与谱面 camera 使用同一位移和过渡，因此谱面滚动时像窗口一样扫过固定图片；
- 实现使用 SVG alpha `mask` 或可证明等价的合成方式，以同时支持填充字形和描边线条；不能用忽略 stroke 轮廓的简单 `clipPath` 替代；
- 切换图片、颜色、每行小节数或素材文件夹后必须重建或更新蒙版，不得改变 OSMD 排版坐标、音符命中坐标或主 Transport 状态。

### FR-10 MVP-1 全局视觉效果

MVP-1 仅支持 `rainDrop + glow + colorize`，整首乐曲使用同一套全局配置。暂不支持逐小节、逐次反复、逐声部或单音符覆盖。

#### FR-10.1 效果属性模型

```ts
interface EffectInstance {
  id: string;
  type: string;
  enabled: boolean;
  phase: "entrance" | "hit" | "sustain" | "release" | "continuous";
  startOffsetMs: number;
  durationMs: number;
  easing: string;
  blendMode: "normal" | "add" | "screen" | "multiply" | "overlay";
  properties: Record<string, unknown>;
  seed?: number;
}
```

#### FR-10.2 MVP-1 效果目录

| `type` | 视觉用途 | 建议 properties |
|---|---|---|
| `colorize` | 变色、渐变、按谱表双色 | `treble`, `bass`, `mix`, `saturation` |
| `glow` | 音符周围发光 | `color`, `radiusPx`, `intensity`, `threshold`, `pulseHz` |
| `rainDrop` | 从画面上方落入 notehead，并在命中后停留 | `durationMs`, `spawnOffsetY`, `easing`, `stretch` |

颜色默认按谱表映射：高音谱表和低音谱表分别使用独立颜色。跨谱表演奏仍以音符最终显示所在谱表决定颜色。

#### FR-10.3 MVP-2 候选效果（不属于 MVP-1 验收）

| `type` | 视觉用途 | 建议 properties |
|---|---|---|
| `blink` | 命中闪烁、呼吸闪动 | `frequencyHz`, `minOpacity`, `maxOpacity`, `waveform` |
| `bounce` | 命中后跳跃或回弹 | `heightPx`, `count`, `damping`, `squash`, `stretch` |
| `bloom` | 高亮区域向外泛光 | `strength`, `radius`, `threshold` |
| `gaussianBlur` | 柔化、凝聚、梦境过渡 | `radiusPx`, `direction`, `quality` |
| `afterimage` | 运动残影 | `damping`, `opacity`, `tint`, `frameCount` |
| `trail` | 下落轨迹、流光尾迹 | `lengthMs`, `widthPx`, `fade`, `gradient`, `sparkleDensity` |
| `sparkle` | 星点闪光 | `count`, `sizePx`, `lifetimeMs`, `spreadPx`, `twinkleHz`, `seed` |
| `particleBurst` | 命中时粒子绽放 | `count`, `speed`, `gravity`, `lifetimeMs`, `shape`, `seed` |
| `ripple` | 命中位置扩散光环 | `radiusFrom`, `radiusTo`, `widthPx`, `opacity`, `count` |
| `shimmer` | 扫光、珠光闪烁 | `angleDeg`, `widthPx`, `speed`, `intensity`, `color` |
| `chromaticAberration` | 轻微彩色边缘分离 | `offsetPx`, `angleDeg`, `radial`, `mix` |
| `noiseDistortion` | 水波、空气扰动 | `amplitudePx`, `frequency`, `speed`, `octaves`, `seed` |
| `rotation` | 旋转或摇摆 | `fromDeg`, `toDeg`, `pivot`, `oscillationHz` |
| `scalePulse` | 按节拍放大缩小 | `minScale`, `maxScale`, `frequency`, `syncToBeat` |
| `softShadow` | 提升层次与漂浮感 | `color`, `blurPx`, `offsetX`, `offsetY`, `opacity` |
| `bokeh` | 背景散景光斑 | `count`, `radiusRange`, `opacityRange`, `drift`, `seed` |
| `filmGrain` | 柔和质感 | `amount`, `size`, `colored`, `seed` |
| `vignette` | 聚焦当前谱面区域 | `amount`, `softness`, `color` |

其中“高斯变换”在实现中拆分为两类明确属性：几何变换使用 `position/scale/rotation`，画面柔化使用 `gaussianBlur`，避免一个名称承担两种语义。

#### FR-10.4 MVP-2 候选 Preset

| Preset | 效果链 | 使用建议 |
|---|---|---|
| `dreamyRain` | `rainDrop + trail + glow + ripple + sparkle` | 默认基础主题 |
| `softBloom` | `fadeIn + gaussianBlur + bloom + shimmer` | 安静、抒情小节 |
| `starlight` | `popIn + sparkle + colorize + afterimage` | 高音旋律或高潮前奏 |
| `floatingCloud` | `materialize + noiseDistortion + bokeh + glow` | 慢速、留白较多的小节 |
| `magicBounce` | `scaleIn + bounce + particleBurst + chromaticAberration` | 节奏鲜明或高潮小节 |

Preset 只是可复用默认值；用户可以覆盖任意 property。

#### FR-10.5 MVP-1 全局配置

```yaml
visual:
  rainDrop:
    durationMs: 1200
    spawnOffsetY: -120
    easing: easeInCubic
    stretch: 1.15
  glow:
    color: "#FFFFFF"
    radiusPx: 18
    intensity: 0.8
    pulseHz: 0
  colorize:
    treble: "#78D7FF"
    bass: "#C69BFF"
    saturation: 1.0
```

反复记号、D.C.、D.S. 或 Coda 使同一书面小节被多次播放时，每次经过都使用相同全局效果。内部时间轴仍为每次经过生成独立 `playbackOccurrence`，以保存不同的命中时间，但用户无需编辑 occurrence。

#### FR-10.6 性能与可读性约束

- 音符层与后处理层分离；Bloom、景深、色差、颗粒等通过有序 post-processing pass 执行；
- 任何效果不得使目标音符在命中时无法辨认；
- 强模糊、色差和粒子不能覆盖谱号、调号、小节线及相邻音符；
- 每个 preset 设置 GPU 预算和最大活跃粒子数，超预算时按既定顺序降级；
- `reducedMotion` 关闭弹跳、快速闪烁、强缩放和色差，只保留柔和颜色、低强度发光；
- 对闪烁效果限制频率与亮度，并提供禁用选项，避免引发视觉不适。

MVP-1 默认命中表现：

- 0–80 ms：白色或主题色光环快速放大；
- 80–240 ms：光环透明度衰减至 0；
- 雨滴命中后保持目标谱表的配置颜色和低强度 Glow；
- 雨滴持续停留，直到所属谱面行滚出视口；
- 高音谱表与低音谱表分别映射颜色；
- 发光和变色不得改变谱面布局，也不得遮盖相邻记谱元素。

### FR-11 MIDI 音乐声

#### FR-11.1 基础音乐声

MVP-1 直接使用用户选择的本地 MIDI：

1. 保留 tempo map、力度、踏板和 Program Change；
2. 通过固定版本的 SoundFont/Muse Sounds/虚拟乐器渲染为 WAV；
3. WAV 与动画共享 MIDI 时间轴；
4. 记录渲染器、音源名称、版本、preset 与哈希；
5. 默认音轨目标是忠实、可重复和同步，不在 MVP 内自动改编旋律或节奏。

MVP-1 推荐固定采用 FluidSynth + 一个允许随应用分发的 General MIDI SoundFont。网页只提供音量和试听控制；音频合成在本地服务中完成。这样可以自动生成确定性音轨，但音色目标只是“正确可用”，不是最终梦幻质感。

#### FR-11.2 MVP-2 音乐增强开放接口

后续允许把 MIDI 或基础 WAV 交给第三方工具手动处理，再将增强后的 WAV 导回 MelodyRain。增强能力分为：

| 层级 | 可做变换 | 候选工具 | 同步风险 |
|---|---|---|---|
| MIDI 表情编辑 | 力度曲线、时值、Humanize、琶音、和弦、节奏概率 | Ableton Live、Logic Pro | 中；可能改变 note-on |
| 虚拟乐器/音源 | 钢琴、钟琴、Pad、弦乐、合唱、分层音色 | Muse Sounds、SoundFont、VST/AU、FluidSynth | 低；通常保留 MIDI 时序 |
| 音频效果链 | Reverb、Delay、Chorus、Shimmer、EQ、压缩、Stereo Width、Granular | 任意 DAW 或插件 | 低到中；会产生效果尾音和延迟 |
| AI 乐器演奏 | 根据 MIDI 生成更自然的力度、连奏、发音法 | ACE Studio AI Instruments | 中；需验证实际 attack |
| AI 再创作 | Remix、Style、Extend、情绪相似新编曲 | Udio、Suno、AIVA | 高；通常改变结构，不可直接替换 |

推荐顺序：先保留原 MIDI 时间结构，只更换音源并增加混响、延迟、合唱或 Shimmer；确认视觉同步后，再尝试会改变演奏表情的工具。

人工第三方工作流建议：

1. MelodyRain 导出 `reference.mid`；
2. 用户在 MuseScore Studio + Muse Sounds、REAPER、Ableton Live 或其他 DAW 中导入 MIDI；
3. 更换钢琴/钟琴/Pad 等音源，并添加 Reverb、Delay、Chorus 或 Shimmer；
4. 从 `00:00:00.000` 导出 48 kHz WAV，不裁掉开头静音；
5. MVP-2 由 MelodyRain 导回 WAV 并做同步检查；在该功能实现前，可由 FFmpeg 手工替换音轨。

不建议在 MVP-1 中把完整 DAW 功能重新实现到网页。Web Audio 适合试听、音量和少量实时效果，但高质量音源管理、插件兼容、自动化曲线和混音交给成熟第三方软件更可靠。

#### FR-11.3 MVP-2 第三方手工交换契约

系统导出：

- `reference.mid`：原始时间轴；
- `reference.wav`：基础试听；
- `tempo-map.json`：速度和拍号；
- `audio-guide.wav`：开头包含同步用短脉冲的工作文件；
- `audio-handoff.md`：采样率、声道、起点和导出要求。

第三方工具回传：

- 48 kHz、24-bit WAV；
- 时间轴从 `00:00:00.000` 开始，不裁掉开头静音；
- 不改变 BPM、拍号、段落长度，除非同时回传新的事件时间表；
- 允许保留混响/延迟尾音，并单独记录 `tailDurationMs`；
- 导入后执行 onset 对齐检查。若 P95 attack 偏差超过 16.67 ms，则不能沿用原动画时间轴，必须重新对齐。

AI 再创作工具产生的新音乐只作为新的创作分支。由于其可能改变音符、速度、段落和总时长，必须重新生成或重新对齐 MIDI/MusicXML，不能把生成音频直接覆盖原视频音轨。

### FR-12 视频导出

MVP-1 只生成竖屏视频：

| 属性 | MVP-1 默认值 |
|---|---|
| 分辨率 | 1080×1920 |
| 画幅 | 9:16 |
| 帧率 | 60 fps 恒定帧率 |
| 视频编码 | H.264 High Profile |
| 像素格式 | yuv420p |
| 音频 | AAC，48 kHz，立体声 |
| 容器 | MP4 |

渲染时刻必须由 `frameIndex / fps` 计算。任何一帧的动画状态都能直接由绝对时间求得，禁止依靠上一帧积分，以保证断点渲染和重复渲染一致。MVP-1 输出文件名为 `melody-rain.portrait.mp4`。

用户必须能够选择导出的起始小节和结束小节：

- 默认范围为全曲；
- 起点取所选起始小节第一次播放 occurrence 的开始时间；
- 终点取所选结束小节最后一次播放 occurrence 的结束时间；
- 若选择范围包含反复、D.C.、D.S. 或 Coda，按照实际播放顺序包含该范围内的所有 occurrence；
- 导出片段需要增加足够的动画预卷，使起始小节首个雨滴能从画面外完整进入；
- 片段音频、动画和谱面滑动必须使用同一裁剪后的时间原点。

### FR-13 质量报告

每次导出生成 `quality-report.json`，至少包括：

- 源文件哈希与解析器版本；
- `renderProfileId`、画布尺寸、画幅、安全区、缩放和每行小节配置；
- 音符总数、已匹配数、未匹配数和匹配率；
- 最早/最晚事件、总时长；
- 坐标缺失数和越界数；
- A/V 总时长差；
- 随机抽样命中误差；
- 渲染帧数、丢帧数和编码信息；
- 告警与降级项。

---

## 6. 非功能需求

### NFR-01 同步精度

- 在 60 fps 导出中，动画命中帧与音频 note-on 的偏差绝对值 ≤ 1 帧（16.67 ms）；
- P95 偏差 ≤ 1 帧，最大偏差 ≤ 2 帧；
- 最终音视频轨总时长差 ≤ 20 ms；
- 同一输入与配置重复导出时，事件命中帧必须完全一致。

### NFR-02 视觉正确性

- 目标点必须落在对应 notehead 边界框内；
- 所有目标点必须处于可见画布范围内；
- 和弦、跨谱表音符与加线音符不得被压到相邻谱表；
- 符头、符干、符尾、附点、升降号、加线、modifier 与共享 beam 在任意动画帧不得彼此分离；
- 空心符头在变色、发光和停留阶段必须保持空心；
- 跨音符连接符号的生长端点必须位于其原始 SVG 路径上，到终止音符命中时完整显示；
- 谱面说明元素只能改变透明度，不得因渐显发生位置或布局变化；
- 文字、谱号、调号和小节线不得因动画层发生布局位移。

### NFR-03 性能

基准机器为 8 核 CPU、16 GB 内存、近五年内的独立或集成 GPU：

- 3 分钟钢琴谱解析与预览生成 ≤ 60 秒；
- 30 秒 1080p60 视频的软件渲染目标 ≤ 10 分钟；
- 预览交互在常规桌面浏览器中保持平均 30 fps 以上；
- 单任务峰值内存目标 ≤ 4 GB，不将完整无压缩帧序列常驻内存。

这些是工程目标，需用基准项目验证后调整，不作为硬件采购承诺。

### NFR-04 安全与隐私

- 只允许访问显式许可的域名，防止 SSRF；
- 所有外部文件视为不可信输入；
- XML 禁用外部实体和网络实体解析；
- 下载文件在隔离目录解析；
- 任务日志不得记录 Cookie、授权头或私人下载链接；
- 原始文件和中间产物遵循可配置的自动删除策略。

### NFR-05 可观察性

- 每个阶段输出结构化日志、耗时、输入哈希、输出哈希和错误码；
- 错误信息必须指出失败阶段和用户可采取的下一步；
- 所有任务使用唯一 `jobId` 串联日志和产物。

---

## 7. 建议技术架构

```text
Local MusicXML + MIDI
        |
        v
Local File Validator
        |
        v
Validator + Normalizer
        |
        +---- MusicXML parser ----+
        |                         |
        +---- MIDI parser --------+--> Alignment Engine
                                      |
                                      v
                            score-model.json
                                      |
                  +-------------------+-------------------+
                  |                                       |
                  v                                       v
          SVG Score Renderer                       Offline Audio Renderer
                  |                                       |
                  v                                       v
          layout-map.json                              audio.wav
                  |                                       |
                  +-------------------+-------------------+
                                      v
                      Animation Timeline + Effect Config
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
                  Browser Preview             Frame Renderer
                                                   |
                                                   v
                                                FFmpeg
                                                   |
                                                   v
                                             output.mp4
```

### 7.1 推荐实现边界

- **Web/渲染层：** TypeScript 网页 + SVG 乐谱 + Canvas/WebGL 动画叠层；
- **效果层：** property-driven effect registry + WebGL post-processing pipeline；
- **本地应用层：** Node.js/TypeScript 本地服务，监听 loopback 地址并为网页提供 API；
- **MIDI：** 使用支持 tempo map、控制器与重叠同音事件的成熟解析库；
- **音频：** FluidSynth 或等价离线 SoundFont 合成器，固定版本和 SoundFont 哈希；
- **视频：** 网页生成确定性帧，本地服务通过子进程调用 FFmpeg 编码并封装音频；
- **谱面坐标：** 从谱面引擎的稳定音符 ID、SVG 元素或图形模型取得。

浏览器页面不能直接任意启动本机 FFmpeg，因此 MVP-1 不是纯静态网页。用户启动 MelodyRain 本地服务后，由服务打开 `localhost` 网页；网页提交渲染任务，本地服务以参数数组启动 FFmpeg，不拼接未经校验的 shell 命令。

### 7.2 MuseScore.com 参考播放器模式

对示例页面的浏览器实测显示：

- 乐谱主体以独立的整页 SVG 资源加载，例如页面中的 `score_0.svg`，并通过 `<img>` 显示；它不是由播放器每帧重新绘制；
- 播放器在谱面资源之外维护播放/暂停、回到开头、循环、进度滑杆、当前时间/总时长和 BPM 控件；
- 示例页面显示当前 BPM，并提供每次 `-5 BPM` / `+5 BPM` 的微调；
- 页面 DOM 中没有可供业务层直接使用的逐音符 HTML 节点，也未暴露公开的“音符坐标 API”。因此可以确认矢量谱面和播放控制相互分层，但“时间如何映射到 SVG 内的具体音符”属于站点内部数据/实现，不能把 CSS 类名或未公开接口作为依赖。

本项目借鉴该产品模式，而不依赖或复制 MuseScore.com 私有前端代码、混淆脚本、未公开接口、受版权保护的谱面资源：

```text
Canonical Score Model --> Engraver --> immutable SVG systems/pages
          |
          +--> Playback Expander --> ordered playback occurrences
                                       |
Aligned MIDI Performance ---------------+--> Tempo Map / Time Index
                              |
                         Master Transport
                    +---------+----------+
                    |         |          |
                    v         v          v
                  Audio   Score State  Animation/Camera
```

对应 MelodyRain 的实现规则：

1. 同一份规范化乐谱模型同时派生 SVG、展开后的播放顺序和逻辑时间索引，避免三个子系统各自解释反复、跳房子与速度标记；对齐后的 MIDI 再为逻辑事件提供实际 attack、release、力度和踏板时间，二者共同生成最终时间索引；
2. SVG 是排版后的世界坐标来源；`NoteVisualGroup` 直接复用完整 SVG 记谱分组，说明元素由定时渐显控制器管理，跨音符连接符由路径裁切控制器管理，三者不得重新解释排版坐标；
3. 每个 `playbackOccurrence` 必须映射到稳定 `scoreEventId`、`LayoutTarget`、开始/结束时间和 `systemIndex`；
4. Transport 是唯一播放真相来源；音频、进度滑杆、当前小节、动画和 camera 均读取同一快照；
5. 进度跳转、循环和变速只修改 Transport，不直接命令各视觉对象；视觉层根据新快照重建；
6. 预览可以采用实时音频时钟，离线导出必须采用确定性帧时钟；二者消费相同时间索引；
7. MuseScore 页面只能作为人工竞品/交互冒烟参考，不能成为运行时依赖或自动化测试的唯一基准。

MusicXML 与 MIDI 同时存在时不得形成两个互相竞争的 Transport：MusicXML 决定“这是哪个书面音符、位于哪个 occurrence 和系统”，MIDI 决定“它实际何时发音以及如何发音”。若 MIDI 与逻辑播放顺序无法达到对齐门槛，系统必须报错，不得在部分模块偷偷改用 MusicXML 合成时间。

### 7.3 谱面引擎选型验证

MVP-1 开发前必须用同一组 MusicXML 做 OSMD 与 Verovio 的技术验证，不能只凭文档决定。验证项目包括：

| 能力 | OSMD 验证点 | Verovio 验证点 |
|---|---|---|
| MusicXML 兼容性 | 钢琴谱、跨谱表、连线、反复显示质量 | MusicXML 转换后的符号和版式损失 |
| 稳定音符 ID | 图形模型能否稳定对应源音符 | SVG note ID 与 timemap note ID 能否直接对应 |
| 隐藏 notehead | 隐藏音符头但保留符干、横梁、连线 | 是否能按 ID 隐藏 notehead 子元素 |
| 每行小节数 | 注入 MusicXML system break 后能否稳定重排 | 转换为 MEI 后插入 system break 的可控性 |
| 实时预览 | 重排速度和坐标重算成本 | WASM 渲染、分页和 timemap 生成速度 |
| 时间映射 | MusicXML/MIDI 需自行对齐的工作量 | timemap 的 note-on/off ID 能否减少对齐工作 |

建议决策规则：如果 Verovio 对目标钢琴谱的 MusicXML 转换质量合格，优先考虑 Verovio，因为其 SVG ID 与 timemap 更贴合动画定位；如果转换造成明显记谱损失，则使用 OSMD，并自行建立稳定事件映射。最终选择必须记录在 ADR（Architecture Decision Record）中。

### 7.4 本地进程结构

```text
MelodyRain Launcher
  |
  +-- Local Node Service (127.0.0.1 only)
  |     +-- Project/File Manager
  |     +-- MusicXML + MIDI Parser
  |     +-- Audio Renderer (FluidSynth)
  |     +-- Render Job Manager
  |     +-- FFmpeg Process
  |
  +-- Browser UI
        +-- File selection
        +-- Score preview
        +-- Measures-per-system live editing
        +-- rainDrop/glow/colorize controls
        +-- Playback and segment selection
        +-- Render progress
```

- 本地服务只监听 `127.0.0.1`，使用每次启动随机 token 防止其他网页调用；
- FFmpeg、FluidSynth 和 SoundFont 路径在启动时检测；
- 长时间渲染通过 job API 报告进度并允许取消；
- 前端关闭后，正在渲染的任务行为必须明确：MVP-1 默认继续渲染，重新打开页面可恢复状态；
- 后续可把同一前端和本地服务封装为 Electron/Tauri，但 MVP-1 不需要先承担桌面壳复杂度。

### 7.5 目录与产物

```text
jobs/{jobId}/
  source/
    score.musicxml|score.mxl
    performance.mid
    reference.pdf                 # optional
  normalized/
    score-model.json
    performance-events.json
    alignment-report.json
  preview/
    index.html
    score.svg
    audio.wav
    timeline.json
    visual-config.yaml
  render/
    {renderProfileId}/
      score.svg
      layout-map.json
      render-config.json
      quality-report.json
  output/
    melody-rain.{renderProfileId}.mp4
    thumbnail.{renderProfileId}.png
```

默认不落盘保存完整 PNG 帧序列；帧通过管道送入编码器。调试模式可保留指定帧。

---

## 8. 数据契约

### 8.1 ScoreEvent

```ts
interface ScoreEvent {
  id: string;
  partId: string;
  staffId: string;
  voiceId: string;
  measureIndex: number;
  beat: number;
  pitchMidi: number;
  writtenPitch: string;
  durationQuarter: number;
  tie: "none" | "start" | "continue" | "stop";
  playbackOccurrence: number;
}
```

### 8.2 PerformanceEvent

```ts
interface PerformanceEvent {
  id: string;
  channel: number;
  pitchMidi: number;
  velocity: number;
  attackMs: number;
  keyReleaseMs: number;
  audibleEndMs: number;
}
```

### 8.3 LayoutTarget

```ts
interface LayoutTarget {
  scoreEventId: string;
  renderProfileId: string;
  systemIndex: number;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSpace: "video-pixel";
}
```

### 8.4 TimelineEvent

```ts
interface TimelineEvent {
  scoreEventId: string;
  performanceEventId: string | null;
  playbackOccurrence: number;
  targets: LayoutTarget[];
  spawnMs: number;
  hitMs: number;
  releaseMs: number;
  entrance: EffectInstance;
  effects: EffectInstance[];
  confidence: number;
}
```

### 8.5 TempoMap 与 TransportSnapshot

```ts
interface TempoSegment {
  startScoreQuarter: number;
  endScoreQuarter: number;
  startSourceMs: number;
  endSourceMs: number;
  startBpm: number;
  endBpm: number;
  interpolation: "step" | "linear" | "easeIn" | "easeOut";
}

interface TransportSnapshot {
  state: "idle" | "playing" | "paused" | "ended";
  presentationTimeMs: number;
  sourceTimeMs: number;
  scoreQuarter: number;
  tempoScale: number;
  effectiveBpm: number;
  playbackOccurrence: number | null;
  measureIndex: number | null;
  systemIndex: number | null;
  activeTimelineEventIds: string[];
}
```

`TempoSegment` 必须覆盖常速、离散 tempo 标记、渐快/渐慢及显式停顿；不得只保存单个“全曲 BPM”。`TransportSnapshot` 是一帧内所有消费者共享的不可变快照。消费者不得在读取快照后自行累加时间。首音符静音预卷期间 `sourceTimeMs` 和 `presentationTimeMs` 允许为负数，`state` 为 `playing`，`activeTimelineEventIds` 必须为空，进度条显示值钳制为 `0`；视觉层必须使用负时间快照计算首音符的下落位置，不得把负时间提前钳制为 `0`。

所有毫秒值使用整数；内部解析可使用有理数或高精度数值，最终只在生成时间轴时取整。

---

## 9. 错误码

| 错误码 | 含义 | 用户动作 |
|---|---|---|
| `MUSICXML_NOT_SELECTED` | 用户未选择 MusicXML/MXL | 选择本地乐谱文件 |
| `MIDI_NOT_SELECTED` | 用户未选择 MIDI | 选择本地 MIDI 文件 |
| `LOCAL_FILE_INVALID` | 文件格式、签名或内容无效 | 重新从 MuseScore 下载正确格式 |
| `SOURCE_VERSION_MISMATCH` | MusicXML 与 MIDI 不是同一版本 | 选择同一次下载/导出的文件 |
| `UNSUPPORTED_SCORE` | 乐谱结构超出 MVP 范围 | 选择钢琴独奏谱或等待后续支持 |
| `ALIGNMENT_BELOW_THRESHOLD` | MIDI 对齐率不足 | 检查源文件版本，或改用由 MusicXML 生成的 MIDI |
| `LAYOUT_TARGET_MISSING` | 有音符无法取得坐标 | 查看渲染兼容性报告 |
| `LAYOUT_DENSITY_WARNING` | 当前每行小节数造成拥挤 | 减少小节数或确认自动适配建议 |
| `LAYOUT_COLLISION` | 出现符号碰撞或不可读缩放 | 修改每行小节数后再导出 |
| `AUDIO_RENDER_FAILED` | 音频合成失败 | 检查 MIDI/SoundFont |
| `VIDEO_RENDER_FAILED` | 帧渲染或编码失败 | 重试并保留诊断包 |

---

## 10. 验收标准

### AC-01 标准钢琴谱端到端

给定用户已下载到本地的同版本 MusicXML 与 MIDI：

- 能生成可播放预览；
- 能生成 1080p60 MP4；
- 视频有可辨识的钢琴音频；
- 所有已匹配音符从上方落下并在 note-on 时命中原谱对应 notehead 中心；
- 初始暂停画面不显示首音；点击播放后首音在静音预卷中完整下落，并在音频 `0 ms` 开始发声时命中；预卷期间无活动 MIDI 音符且进度条仍显示 `00:00`；
- 在首音下落过程中再次点击播放，或点击“回到开头”，预卷立即取消且首音重新隐藏；再次播放时必须从雨滴起点重新执行完整预卷；
- 原始 notehead 不直接显示，雨滴命中后停留并产生发光和谱表颜色；
- 对齐率、同步误差满足 NFR-01。

### AC-02 和弦

给定至少一个三音和弦，系统生成一个组合雨滴对象；该对象在同一命中帧覆盖三个目标 notehead，作为一个整体参与移动和发光。

### AC-03 跨谱表与加线

左右手同时演奏、包含加线音符时，动画不得落入错误谱表或相邻音高位置；每条加线必须与所属音符使用相同 transform 共同下落并同时命中。

### AC-04 速度变化

包含 accelerando 或多段 tempo event 的测试谱中，命中时刻必须跟随展开后的 tempo map，曲末累计误差仍满足 NFR-01。

### AC-05 反复与连音线

- 反复段第二次播放时再次触发对应动画；
- 两次播放使用相同的全局效果配置，但具有不同 `playbackOccurrence` 和命中时间；
- 仅由连音线延续、没有新 attack 的音符不得重复下落；
- 延音线、圆滑线或 glissando 在起始音命中前不可见，起始音命中后从左向右生长，并在终止音书面起点到达时完整显示；
- 没有新 attack 的 tie continuation 音符/和弦在终止位置直接显示，不执行下落，并保持空心语义、谱表颜色和低强度 Glow。

### AC-05.1 完整记谱单元

- 给定带升降号、附点、符尾、加线和 articulation 的音符，所有附属 SVG 元素必须与符头使用相同 transform；
- 给定三音和弦，三个符头、共享符干、附属记号和琶音符号作为一个组合对象下落；
- 给定连续八分或十六分音符，全部符头、外置符干和共享连杆作为一个整体下落；
- 给定二分音符或全音符，命中后的主题色只作用于原符号轮廓，符头内部保持透明。
- 给定任意时值的休止符，其完整休止符字形和附属记号必须从上方下落，并在书面起点准确命中；只含休止符的小节同样必须建立时间锚点；
- 给定 VexFlow 外置渲染的 tremolo、stroke 或 ornament，其必须与所属音符使用相同 transform，不得单独留在谱面上；

### AC-05.2 谱面说明元素渐显

- 播放开始前，小节编号、速度、力度、发夹及 FR-09.3 所列说明元素不可见；
- Transport 到达各自触发位置后，元素在原谱坐标用 300 ms 从透明渐显至完全可见；
- 渐显不得包含位移、缩放或下落；
- 将进度条跳至触发点之前时元素重新隐藏，跳至触发点 300 ms 之后时元素立即完全显示；
- 预览与离线导出在同一绝对时间的透明度和连接线生长比例必须一致。

### AC-06 本地文件选择失败

当缺少文件、文件损坏或 MusicXML/MIDI 不属于同一版本时：

- 任务在本地校验阶段停止；
- 返回明确错误码和失败的文件格式；
- 不得生成缺少正确五线谱数据的降级成品。

### AC-07 确定性

同一源文件、配置、软件版本和 SoundFont 连续导出两次：

- 每个事件的命中帧完全一致；
- 音频 PCM 哈希一致，或在明确记录的编码器非确定性范围内一致；
- 输出帧抽样像素差为 0，或在明确记录的 GPU 容差内通过。

### AC-08 失败可诊断

人为提供不同版本的 MusicXML 与 MIDI 时，任务应在对齐阶段失败，质量报告需列出匹配率、首批差异小节及建议动作。

### AC-09 全局效果配置

调整整首乐曲的 `rainDrop`、`glow` 与 `colorize` 属性后：

- 所有小节使用新的全局属性；
- 高音谱表和低音谱表使用各自配置颜色；
- 修改发光或颜色不得改变命中帧和目标坐标；
- 界面不显示逐小节 selector 编辑入口。

### AC-10 谱面纵向滑动

播放跨越至少三个谱面系统的测试谱时：

- 屏幕可见上一行、当前行和下一行的全部或部分内容；
- 当前行结束后谱面纵向向上滑动；
- 跨系统延音未结束时不得滑动；
- 下一行雨滴可以在滑动开始前生成，并在滑动过程中保持对准目标。

### AC-11 竖屏导出

给定 MVP-1 竖屏 RenderProfile：

- 生成 1080×1920、9:16、60 fps 竖屏 MP4；
- 音频、动画总时长和命中时刻满足 NFR-01；
- 输出对应 layout map 和质量报告；
- MVP-1 不提供横屏导出入口，也不得通过旋转、拉伸或裁切竖屏成品生成横屏版本。

### AC-12 手动控制每行小节数

用户把每行小节数从默认 3 改为 2：

- 页面实时重新排谱并显示新的系统换行；
- 修改小节数后自动使旧坐标缓存失效并重新计算；
- 系统不得静默改成其他数值；
- 若数值过大导致拥挤，显示问题位置和推荐值，必须由用户确认自动适配；
- 存在碰撞或不可读缩放时阻止正式导出。

### AC-13 单一 Transport 与变速

对包含至少两个 tempo 标记和一段渐慢的测试谱，以 `1.0×` 和非 `1.0×` 各播放、跳转并导出一次：

- 音频、进度条、当前小节、雨滴命中和谱面滚动使用同一 `TransportSnapshot`；
- `+5 BPM` / `-5 BPM` 改变全局 `tempoScale`，各 tempo 段之间的相对速度关系保持不变；
- 从进度条跳转后，当前 occurrence、小节、系统、已停留雨滴和正在下落雨滴在下一绘制帧正确重建；
- 在曲首播放时，浏览器音频解锁所触发的内部 `play` / `pause` 事件不得改变预卷的 `playing` 状态或中断帧循环；
- `0.5×`、`1.0×` 和 `1.5×` 下的首音预卷均按同一 source-time 公式推进，并在各自 `sourceTimeMs = 0` 的快照中命中；
- 预览与离线导出在相同 `tempoScale` 下的命中时刻误差满足 NFR-01；
- 连续运行 10 分钟不得因逐帧累计造成可测的线性漂移。

---

## 11. 测试资产矩阵

MVP 至少维护以下自有或可合法再分发的固定测试谱：

| 资产 | 覆盖点 |
|---|---|
| 单音 C 大调音阶 | 基础音高、坐标、时序 |
| 双手钢琴短曲 | 高低音谱表、左右手 |
| 和弦练习 | 同时命中、重复同音 |
| 变速练习 | 多段 tempo map |
| 踏板练习 | CC64 与听觉结束时间 |
| 反复与跳房子 | 播放顺序展开 |
| 连音线与装饰音 | attack 语义 |
| 多系统长谱 | 换行和视口切换 |
| 全局效果测试谱 | rainDrop、glow、按谱表 colorize |
| 可变每行小节数 | 实时系统换行、坐标重算、拥挤检测 |

示例 MuseScore 链接用于人工冒烟测试，不作为唯一自动化测试资产，以避免外部内容、权限或页面结构变化导致测试失效。

---

## 12. MVP-1 里程碑

### M1：本地导入与标准化

- 本地网页应用骨架；
- MusicXML/MIDI 文件选择与安全校验；
- MusicXML/MIDI 解析；
- 统一事件模型与诊断报告。

### M2：可播放五线谱

- SVG 乐谱渲染；
- 离线音频合成；
- 播放器；
- 小节与音符高亮；
- 坐标映射。
- 1080×1920 竖屏 RenderProfile；
- 每行小节数控制、实时排版预览和拥挤检测。

### M3：基础动画

- 音符下落；
- `rainDrop` 统一入场接口；
- 和弦与跨谱表；
- 完整 `NoteVisualGroup`：符头、符干、符尾、附点、升降号、加线、modifier 与共享 beam；
- 跨音符连接符随节奏从左向右生长；
- 小节编号、速度、力度、发夹及其他说明元素按谱面时间执行 300 ms 渐显；
- 全局 `glow` 和按谱表 `colorize`；
- 原始完整记谱单元隐藏、雨滴命中后停留；
- 多系统纵向滑动和超长小节横向滚动；
- reduced motion。

### M4：离线视频与质量门禁

- 确定性逐帧渲染；
- FFmpeg 输出；
- A/V 同步测试；
- 质量报告；
- 示例乐谱端到端验收。

---

## 13. 待确认产品问题

以下问题仍需确认：

1. MVP-1 支持的操作系统是只支持 Windows，还是同时支持 Windows/macOS；
2. FFmpeg、FluidSynth 和 SoundFont 是随应用打包，还是要求用户自行安装；
3. 谱面引擎技术验证后选择 OSMD 还是 Verovio；
4. 组合和弦雨滴的多音头之间是否需要连接杆/液滴融合形状；
5. 用户选择的起止小节遇到反复跳出所选范围时，是遵循完整音乐播放路径，还是严格裁剪在编号范围内。

当前已确认：MVP-1 是本地网页应用；用户手工选择本地 MusicXML/MIDI；只输出 1080×1920、9:16 竖屏视频，不开发横屏方案；乐谱符号按原尺寸的 2/3 等比例显示，竖屏默认每行 2 小节并实时预览；效果为整曲全局 `rainDrop + glow + colorize`；颜色跟随谱表；雨滴命中后停留到所属行滚出视口；和弦使用覆盖全部音头的多音头组合雨滴；谱面行播放完后纵向向上滑动；超长小节横向滚动时演奏位置固定在画面中央；用户选择导出起止小节；本地服务调用本机 FFmpeg；MVP-2 再实现更多动画、增强音轨、平台专用竖屏 profile 和自动下载。

---

## 14. 参考实现依据

- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) 可在浏览器或无头 Node.js 环境中把 MusicXML 渲染为 SVG/PNG，并提供可修改的乐谱数据模型；
- [Verovio](https://github.com/rism-digital/verovio)支持 MusicXML 转换、JavaScript/WASM 和 SVG 输出；其 [timemap 输出](https://book.verovio.org/toolkit-reference/output-formats.html)直接列出每个时间点的 note-on/note-off ID，适合作为动画映射候选；
- [Verovio Toolkit Options](https://book.verovio.org/toolkit-reference/toolkit-options.html)提供页面、系统换行、尺寸与布局相关选项，需通过原型验证能否满足严格每行小节数；
- [OSMD 导出说明](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Exporting-PNG%2C-SVG-and-PDF)指出 PDF 导出不是直接支持的正式能力，因此本项目不把 OSMD PDF 导出放在关键路径；
- [Three.js 后处理说明](https://threejs.org/manual/en/how-to-use-post-processing.html)提供按 pass 组合 Bloom、景深、颗粒等效果的通用架构；[TSL 后处理节点](https://threejs.org/docs/TSL.html)还列出 Bloom、Afterimage、色差、景深等可实现效果；
- [Adobe After Effects 模糊效果说明](https://helpx.adobe.com/after-effects/using/blur-sharpen-effects.html)区分 Gaussian Blur、Lens Blur 和 Radial Blur，并说明高亮模糊可形成 Bloom/Glow；本项目据此把几何 transform 与 Gaussian blur 分开建模；
- [Blender Glow 说明](https://docs.blender.org/manual/en/3.6/video_editing/edit/montage/strips/effects/glow.html)将发光描述为亮区模糊后与原画面叠加，其 threshold、boost、blur distance 与本规格的 Glow properties 对应；
- [FluidSynth](https://www.fluidsynth.org/documentation/)是基于 SoundFont 2 的 MIDI 合成器，可把 MIDI 文件渲染为音频，适合可重复的基础音轨；
- 浏览器文件访问需要用户授权且受沙箱约束，[File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)适合本地文件选择和缓存，但不能替代本地进程调用；
- Node.js 的 [child_process](https://nodejs.org/api/child_process.html)可以异步启动 FFmpeg 等本地子进程；MVP-1 使用参数数组和 `spawn`/`execFile`，不把用户输入拼成 shell 命令；
- [FFmpeg 官方文档](https://ffmpeg.org/ffmpeg.html)支持图像序列、音频输入、编码和封装，是本地视频输出路径；
- [MuseScore Studio Handbook](https://handbook.musescore.org/)覆盖 SoundFonts、Muse Sounds、MIDI 与 VST/VSTi；[Muse Sounds](https://handbook.musescore.org/sound-and-playback/installing-musesounds)也可与 VST 或 SoundFont 混合使用；
- [示例 MuseScore.com 页面](https://musescore.com/user/2466621/scores/2271746)用于观察矢量谱面、进度条和 BPM 控件的产品分层；页面实测结果只作为竞品事实记录，不代表其私有网页源码已经公开；
- [MuseScore Studio 播放控制文档](https://handbook.musescore.org/sound-and-playback)说明播放位置可用时间、小节与拍表示，并说明全局播放速度变化仍保持谱内 tempo 标记、渐变速度、呼吸与停顿的相互关系；本项目采用相同的 Transport 语义；
- [MuseScore Studio 开源仓库](https://github.com/musescore/MuseScore)公开的是桌面记谱软件，包含 MusicXML/MIDI 输入输出、排版、音序器和软件合成器；它不能证明 MuseScore.com 网页播放器源码同样开源。
- [Ableton Live 12 MIDI Effects](https://www.ableton.com/en/manual/live-midi-effect-reference/)支持琶音、音高、随机和力度变换，适合人工制作 MIDI 表情与梦幻变奏；
- [Logic Pro MIDI plug-ins](https://support.apple.com/en-gb/guide/logicpro/lgcef1c11e8f/10.7/mac/11.0)包含 Arpeggiator、Chord Trigger、Modulator、移调与随机处理；
- [ACE Studio MIDI Tracks](https://docs.acestudio.ai/project/arrangement-in-canvas/tracks/midi-tracks)可以导入 MIDI 并驱动 AI Voice 或 AI Instrument；[AI Instruments](https://docs.acestudio.ai/ai-instruments/create-instrument-sounds)支持 MIDI/MusicXML、发音法和表达控制，适合人工生成更自然的演奏音轨；
- [Udio Audio Upload](https://help.udio.com/en/articles/10754328-create-music-with-your-own-audio)和 [Suno Audio Upload](https://help.suno.com/en/articles/6141569)面向音频的 remix、style、extend 等再创作；[AIVA](https://www.aiva.ai/legal/1)可把 MIDI/Audio 作为 influence 生成新的 MIDI/Audio。它们可能改变作品结构，因此只列为重新对齐后的创作分支；
- OSMD 的音频播放器不作为 MVP 核心依赖，音频由独立离线合成链生成；
- 示例 MuseScore 页面当前展示为钢琴独奏乐谱，但平台内容与下载权限可能变化。
