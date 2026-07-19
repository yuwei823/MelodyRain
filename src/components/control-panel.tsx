import type { ChangeEvent, CSSProperties, RefObject } from "react";
import { assetRelativePath } from "../lib/asset-folder";
import {
  PERFORMANCE_RAINBOW_PALETTE,
  type PerformanceEffectMode,
} from "../lib/performance-effect-layer";
import type { LoadedProject } from "../hooks/use-project-loader";
import type { BackgroundMode, ConnectedNoteMode } from "../lib/project-settings";
import type { TitleColorMode } from "../lib/title-color";

interface ControlPanelProps {
  project: LoadedProject | null;
  folderName: string | null;
  remembersFolders: boolean;
  scoreFile: File | null;
  midiFile: File | null;
  audioFile: File | null;
  backgroundFiles: File[];
  settingsFile: File | null;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onChooseFolder(): void;
  onSelectFolder(event: ChangeEvent<HTMLInputElement>): void;
  onReadParameters(): void;
  onSaveParameters(): void;
  customTitle: string;
  onCustomTitleChange(value: string): void;
  titleColor: string;
  titleColorMode: TitleColorMode;
  onTitleColorChange(value: string): void;
  onUseAutoTitleColor(): void;
  measuresPerSystem: number;
  onMeasuresPerSystemChange(value: number): void;
  backgroundMode: BackgroundMode;
  onBackgroundModeChange(value: BackgroundMode): void;
  backgroundColor: string;
  onBackgroundColorChange(value: string): void;
  selectedBackgroundIndex: number;
  onSelectedBackgroundIndexChange(value: number): void;
  maskBlackMixPercent: number;
  onMaskBlackMixPercentChange(value: number): void;
  paperTransparencyPercent: number;
  onPaperTransparencyPercentChange(value: number): void;
  performanceEffectMode: PerformanceEffectMode;
  onPerformanceEffectModeChange(value: PerformanceEffectMode): void;
  performanceMixColor: string;
  onPerformanceMixColorChange(value: string): void;
  performanceMixPercent: number;
  onPerformanceMixPercentChange(value: number): void;
  connectedNoteMode: ConnectedNoteMode;
  onConnectedNoteModeChange(value: ConnectedNoteMode): void;
}

export function ControlPanel({
  project,
  folderName,
  remembersFolders,
  scoreFile,
  midiFile,
  audioFile,
  backgroundFiles,
  settingsFile,
  folderInputRef,
  onChooseFolder,
  onSelectFolder,
  onReadParameters,
  onSaveParameters,
  customTitle,
  onCustomTitleChange,
  titleColor,
  titleColorMode,
  onTitleColorChange,
  onUseAutoTitleColor,
  measuresPerSystem,
  onMeasuresPerSystemChange,
  backgroundMode,
  onBackgroundModeChange,
  backgroundColor,
  onBackgroundColorChange,
  selectedBackgroundIndex,
  onSelectedBackgroundIndexChange,
  maskBlackMixPercent,
  onMaskBlackMixPercentChange,
  paperTransparencyPercent,
  onPaperTransparencyPercentChange,
  performanceEffectMode,
  onPerformanceEffectModeChange,
  performanceMixColor,
  onPerformanceMixColorChange,
  performanceMixPercent,
  onPerformanceMixPercentChange,
  connectedNoteMode,
  onConnectedNoteModeChange,
}: ControlPanelProps) {
  return (
    <aside className="app-panel control-panel">
      <div className="ui-card ui-stack folder-picker">
        <div>
          <p className="step-label">SOURCE FOLDER / 素材文件夹</p>
        </div>
        <button className="folder-select-button" type="button" onClick={onChooseFolder}>
          {folderName ? `${folderName}` : "Choose media folder / 选择素材文件夹"}
        </button>
        <input
          className="folder-input-fallback"
          type="file"
          multiple
          ref={(input) => {
            folderInputRef.current = input;
            input?.setAttribute("webkitdirectory", "");
            input?.setAttribute("directory", "");
          }}
          onChange={onSelectFolder}
          aria-label="Choose media folder / 选择素材文件夹"
        />
        <p>{remembersFolders
          ? "This folder will be remembered and reloaded after refresh. / 将记住此文件夹，并在刷新后自动重新读取乐谱、MIDI、MP3 和背景图片。"
          : "Automatically matches MXL/MusicXML, MIDI and MP3 files with the same name, plus background images. / 自动匹配同名的 MXL/MusicXML、MIDI 和 MP3，并读取背景图片。"}</p>
        {(scoreFile || midiFile || audioFile || backgroundFiles.length > 0) && (
          <div className="matched-assets">
            <div><span>Score / 乐谱</span><strong>{scoreFile ? assetRelativePath(scoreFile) : "Missing / 缺失"}</strong></div>
            <div><span>MIDI</span><strong>{midiFile ? assetRelativePath(midiFile) : "Missing / 缺失"}</strong></div>
            <div><span>MP3</span><strong>{audioFile ? assetRelativePath(audioFile) : "Missing / 缺失"}</strong></div>
            <div>
              <span>Background / 背景</span>
              <strong>{backgroundFiles.length > 0 ? `${backgroundFiles.length} images / 张图片` : "Solid color / 纯色 #000000"}</strong>
            </div>
          </div>
        )}
        <div className="parameter-file-actions">
          <button type="button" onClick={onSaveParameters} disabled={!project}>Save settings / 保存参数</button>
          <button type="button" onClick={onReadParameters}>Load settings / 读取参数</button>
        </div>
        <small className="parameter-file-status">
          {settingsFile ? `Found / 已发现：${settingsFile.name}` : "Settings file / 参数文件：melody-rain.settings.json"}
        </small>
      </div>

      <div className="ui-card ui-stack title-control">
        <span className="step-label">TITLE / 画面标题</span>
        <input
          type="text"
          value={customTitle}
          placeholder={project?.label ?? "Waiting for media / 等待素材"}
          onChange={(event) => onCustomTitleChange(event.target.value)}
          aria-label="Display title / 画面标题"
        />
        <div className="form-row form-row--color-action title-color-control">
          <span>Title color / 标题颜色</span>
          <input
            type="color"
            value={titleColor}
            onChange={(event) => onTitleColorChange(event.target.value)}
            aria-label="Title color / 标题颜色"
          />
          <output>{titleColor.toUpperCase()}</output>
          <button
            type="button"
            aria-pressed={titleColorMode === "auto"}
            onClick={onUseAutoTitleColor}
          >
            Auto / 自动
          </button>
        </div>
      </div>

      <div className="ui-card layout-control">
        <div className="layout-control-heading">
          <div>
            <p className="step-label">LAYOUT / 每行小节数</p>
          </div>
        </div>
        <div className="segmented-control segmented-control--three layout-options" aria-label="Measures per system / 每行小节数">
          {[1, 2, 3].map((value) => (
            <button
              type="button"
              aria-pressed={measuresPerSystem === value}
              key={value}
              onClick={() => onMeasuresPerSystemChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="ui-card ui-stack background-control">
        <div>
          <p className="step-label">BACKGROUND / 谱面背景</p>
        </div>
        <div className="segmented-control" aria-label="Mask background mode / 蒙版背景模式">
          <button
            type="button"
            aria-pressed={backgroundMode === "image"}
            disabled={!project?.backgrounds.length}
            onClick={() => onBackgroundModeChange("image")}
          >
            Image / 图片
          </button>
          <button
            type="button"
            aria-pressed={backgroundMode === "color"}
            onClick={() => onBackgroundModeChange("color")}
          >
            Color / 纯色
          </button>
        </div>
        {backgroundMode === "image" && project?.backgrounds.length ? (
          <label className="form-row">
            <span>Background image / 背景图片</span>
            <select
              value={selectedBackgroundIndex}
              onChange={(event) => onSelectedBackgroundIndexChange(Number(event.target.value))}
            >
              {project.backgrounds.map((background, index) => (
                <option value={index} key={assetRelativePath(background)}>
                  {assetRelativePath(background)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="form-row form-row--color color-control">
            <span>Background color / 背景颜色</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(event) => onBackgroundColorChange(event.target.value)}
              aria-label="Mask background color / 蒙版背景颜色"
            />
            <output>{backgroundColor.toUpperCase()}</output>
          </label>
        )}
        <label className="form-row form-row--range black-mix-control">
          <span>Black mix / 黑色混入</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={maskBlackMixPercent}
            onChange={(event) => onMaskBlackMixPercentChange(Number(event.target.value))}
            aria-label="Mask black mix ratio / 蒙版黑色混入比例"
          />
          <output>{maskBlackMixPercent}%</output>
        </label>
        <label className="form-row form-row--range paper-transparency-control">
          <span>Paper transparency / 谱纸透明度</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={paperTransparencyPercent}
            onChange={(event) => onPaperTransparencyPercentChange(Number(event.target.value))}
            aria-label="Light score paper transparency / 浅色谱纸透明度"
          />
          <output>{paperTransparencyPercent}%</output>
        </label>
      </div>

      <div className="ui-card ui-stack performance-effect-control">
        <div>
          <p className="step-label">NOTE EFFECT / 音符着色</p>
        </div>
        <div className="segmented-control" aria-label="Note coloring / 音符着色">
          <button
            type="button"
            aria-pressed={performanceEffectMode === "mask"}
            onClick={() => onPerformanceEffectModeChange("mask")}
          >
            Shared mask / 共用蒙版
          </button>
          <button
            type="button"
            aria-pressed={performanceEffectMode === "rainbow"}
            onClick={() => onPerformanceEffectModeChange("rainbow")}
          >
            Rainbow / 彩虹色
          </button>
        </div>
        {performanceEffectMode === "mask" ? (
          <>
            <label className="form-row form-row--color color-control">
              <span>Mix color / 混入颜色</span>
              <input
                type="color"
                value={performanceMixColor}
                onChange={(event) => onPerformanceMixColorChange(event.target.value)}
                aria-label="Performance element mix color / 演奏元素混入颜色"
              />
              <output>{performanceMixColor.toUpperCase()}</output>
            </label>
            <label className="form-row form-row--range performance-mix-control">
              <span>Mix strength / 混入强度</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={performanceMixPercent}
                onChange={(event) => onPerformanceMixPercentChange(Number(event.target.value))}
                aria-label="Performance element mix strength / 演奏元素混入强度"
              />
              <output>{performanceMixPercent}%</output>
            </label>
            <small>Uses the same background source and fixed crop as the score, with the selected color overlaid separately. / 与谱面共用同一背景源和固定裁切位置，仅单独叠加所选颜色。</small>
          </>
        ) : (
          <>
            <div className="performance-palette" aria-label="C D E F G A B rainbow palette / 彩虹配色">
              {Object.entries(PERFORMANCE_RAINBOW_PALETTE).map(([step, color]) => (
                <span key={step} style={{ "--performance-color": color } as CSSProperties}>
                  {step}
                </span>
              ))}
            </div>
            <small>Noteheads use written pitch colors; chord stems use the far note, while beams and unpitched elements use gradients. / 音头按书写音名着色；和弦符杆取远端音，连梁与无音高元素使用渐变。</small>
          </>
        )}
      </div>

      <div className="ui-card ui-stack performance-effect-control connected-notes-control">
        <div>
          <p className="step-label">CONNECTED NOTES / 共享连杆音符</p>
        </div>
        <div className="segmented-control" aria-label="Connected note mode / 共享连杆音符模式">
          <button type="button" aria-pressed={connectedNoteMode === "together"}
            onClick={() => onConnectedNoteModeChange("together")}>Fall together / 一并落下</button>
          <button type="button" aria-pressed={connectedNoteMode === "expand"}
            onClick={() => onConnectedNoteModeChange("expand")}>Expand after falling / 落下后展开</button>
        </div>
        <small>Only affects eighth notes, sixteenth notes, and shorter notes sharing a beam. / 仅影响共享符尾连杆的八分、十六分及更短音符。</small>
      </div>
    </aside>
  );
}
