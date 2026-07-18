import type { ChangeEvent, CSSProperties, RefObject } from "react";
import { assetRelativePath } from "../lib/asset-folder";
import {
  PERFORMANCE_RAINBOW_PALETTE,
  type PerformanceEffectMode,
} from "../lib/performance-effect-layer";
import type { LoadedProject } from "../hooks/use-project-loader";

export type BackgroundMode = "image" | "color";

interface ControlPanelProps {
  project: LoadedProject | null;
  folderName: string | null;
  remembersFolders: boolean;
  scoreFile: File | null;
  midiFile: File | null;
  audioFile: File | null;
  backgroundFiles: File[];
  folderInputRef: RefObject<HTMLInputElement | null>;
  onChooseFolder(): void;
  onSelectFolder(event: ChangeEvent<HTMLInputElement>): void;
  customTitle: string;
  onCustomTitleChange(value: string): void;
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
}

export function ControlPanel({
  project,
  folderName,
  remembersFolders,
  scoreFile,
  midiFile,
  audioFile,
  backgroundFiles,
  folderInputRef,
  onChooseFolder,
  onSelectFolder,
  customTitle,
  onCustomTitleChange,
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
}: ControlPanelProps) {
  return (
    <aside className="control-panel">
      <div className="folder-picker">
        <span>素材文件夹</span>
        <button className="folder-select-button" type="button" onClick={onChooseFolder}>
          {folderName ? `更换文件夹：${folderName}` : "选择素材文件夹"}
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
          aria-label="选择素材文件夹"
        />
        <p>{remembersFolders
          ? "将记住此文件夹，并在刷新后自动重新读取乐谱、MIDI、MP3 和背景图片。"
          : "自动匹配同名的 MXL/MusicXML、MIDI 和 MP3，并读取背景图片。"}</p>
        {(scoreFile || midiFile || audioFile || backgroundFiles.length > 0) && (
          <div className="matched-assets">
            <div><span>乐谱</span><strong>{scoreFile ? assetRelativePath(scoreFile) : "缺失"}</strong></div>
            <div><span>MIDI</span><strong>{midiFile ? assetRelativePath(midiFile) : "缺失"}</strong></div>
            <div><span>MP3</span><strong>{audioFile ? assetRelativePath(audioFile) : "缺失"}</strong></div>
            <div>
              <span>背景</span>
              <strong>{backgroundFiles.length > 0 ? `${backgroundFiles.length} 张图片` : "纯色 #000000"}</strong>
            </div>
          </div>
        )}
      </div>

      <label className="title-control">
        <span className="step-label">TITLE</span>
        <strong>画面标题</strong>
        <input
          type="text"
          value={customTitle}
          placeholder={project?.label ?? "等待素材"}
          onChange={(event) => onCustomTitleChange(event.target.value)}
          aria-label="画面标题"
        />
        <small>留空时使用素材原名称。</small>
      </label>

      <div className="layout-control">
        <div className="layout-control-heading">
          <div>
            <p className="step-label">LAYOUT</p>
            <strong>每行小节数</strong>
          </div>
          <output>{measuresPerSystem}</output>
        </div>
        <input
          aria-label="每行小节数"
          type="range"
          min="1"
          max="6"
          step="1"
          value={measuresPerSystem}
          onChange={(event) => onMeasuresPerSystemChange(Number(event.target.value))}
        />
      </div>

      <div className="background-control">
        <div>
          <p className="step-label">MASK SOURCE</p>
          <strong>谱面蒙版背景</strong>
        </div>
        <div className="background-mode" aria-label="蒙版背景模式">
          <button
            type="button"
            aria-pressed={backgroundMode === "image"}
            disabled={!project?.backgrounds.length}
            onClick={() => onBackgroundModeChange("image")}
          >
            图片
          </button>
          <button
            type="button"
            aria-pressed={backgroundMode === "color"}
            onClick={() => onBackgroundModeChange("color")}
          >
            纯色
          </button>
        </div>
        {backgroundMode === "image" && project?.backgrounds.length ? (
          <label>
            <span>背景图片</span>
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
          <label className="color-control">
            <span>背景颜色</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(event) => onBackgroundColorChange(event.target.value)}
              aria-label="蒙版背景颜色"
            />
            <output>{backgroundColor.toUpperCase()}</output>
          </label>
        )}
        <label className="black-mix-control">
          <span>黑色混入</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={maskBlackMixPercent}
            onChange={(event) => onMaskBlackMixPercentChange(Number(event.target.value))}
            aria-label="蒙版黑色混入比例"
          />
          <output>{maskBlackMixPercent}%</output>
        </label>
        <label className="paper-transparency-control">
          <span>谱纸透明度</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={paperTransparencyPercent}
            onChange={(event) => onPaperTransparencyPercentChange(Number(event.target.value))}
            aria-label="浅色谱纸透明度"
          />
          <output>{paperTransparencyPercent}%</output>
        </label>
      </div>

      <div className="performance-effect-control">
        <div>
          <p className="step-label">PERFORMANCE EFFECT</p>
          <strong>演奏元素效果</strong>
        </div>
        <div className="background-mode" aria-label="演奏元素效果模式">
          <button
            type="button"
            aria-pressed={performanceEffectMode === "mask"}
            onClick={() => onPerformanceEffectModeChange("mask")}
          >
            共用蒙版
          </button>
          <button
            type="button"
            aria-pressed={performanceEffectMode === "rainbow"}
            onClick={() => onPerformanceEffectModeChange("rainbow")}
          >
            彩虹色
          </button>
        </div>
        {performanceEffectMode === "mask" ? (
          <>
            <label className="color-control">
              <span>混入颜色</span>
              <input
                type="color"
                value={performanceMixColor}
                onChange={(event) => onPerformanceMixColorChange(event.target.value)}
                aria-label="演奏元素混入颜色"
              />
              <output>{performanceMixColor.toUpperCase()}</output>
            </label>
            <label className="performance-mix-control">
              <span>混入强度</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={performanceMixPercent}
                onChange={(event) => onPerformanceMixPercentChange(Number(event.target.value))}
                aria-label="演奏元素混入强度"
              />
              <output>{performanceMixPercent}%</output>
            </label>
            <small>与谱面共用同一背景源和固定裁切位置，仅单独叠加所选颜色。</small>
          </>
        ) : (
          <>
            <div className="performance-palette" aria-label="C D E F G A B 彩虹配色">
              {Object.entries(PERFORMANCE_RAINBOW_PALETTE).map(([step, color]) => (
                <span key={step} style={{ "--performance-color": color } as CSSProperties}>
                  {step}
                </span>
              ))}
            </div>
            <small>音头按书写音名着色；和弦符杆取远端音，连梁与无音高元素使用渐变。</small>
          </>
        )}
      </div>
    </aside>
  );
}
