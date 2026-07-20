import type { ChangeEvent, RefObject } from "react";
import { assetRelativePath } from "../lib/asset-folder";
import type { LoadedProject } from "../hooks/use-project-loader";
import type { BackgroundMode, ConnectedNoteMode } from "../lib/project-settings";
import type { TitleColorMode } from "../lib/title-color";
import type { FrameColorRange } from "../lib/frame-color-ranges";
import { FrameColorRangeControl } from "./frame-color-range-control";
import { Button } from "./ui/button";
import { CardHeading } from "./ui/card-heading";
import { ColorField } from "./ui/color-field";
import { KeyValueList } from "./ui/kv-list";
import { SegmentedControl } from "./ui/segmented-control";
import { SliderField } from "./ui/slider-field";

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
  performanceMixPercent: number;
  onPerformanceMixPercentChange(value: number): void;
  connectedNoteMode: ConnectedNoteMode;
  onConnectedNoteModeChange(value: ConnectedNoteMode): void;
  performanceColorRanges: FrameColorRange[];
  totalFrames: number;
  onPerformanceColorRangesChange(value: FrameColorRange[]): void;
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
  performanceMixPercent,
  onPerformanceMixPercentChange,
  connectedNoteMode,
  onConnectedNoteModeChange,
  performanceColorRanges,
  totalFrames,
  onPerformanceColorRangesChange,
}: ControlPanelProps) {
  return (
    <aside className="app-panel control-panel">
      <div className="ui-card ui-stack folder-picker">
        <div>
          <p className="step-label">SOURCE FOLDER / 素材文件夹</p>
        </div>
        <Button variant="secondary" className="folder-select-button" onClick={onChooseFolder}>
          {folderName ? `${folderName}` : "Choose media folder / 选择素材文件夹"}
        </Button>
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
          <KeyValueList
            variant="columns"
            items={[
              { label: "Score / 乐谱", value: scoreFile ? assetRelativePath(scoreFile) : "Missing / 缺失" },
              { label: "MIDI", value: midiFile ? assetRelativePath(midiFile) : "Missing / 缺失" },
              { label: "MP3", value: audioFile ? assetRelativePath(audioFile) : "Missing / 缺失" },
              {
                label: "Background / 背景",
                value: backgroundFiles.length > 0
                  ? `${backgroundFiles.length} images / 张图片`
                  : "Solid color / 纯色 #000000",
              },
            ]}
          />
        )}
        <div className="parameter-file-actions">
          <Button variant="secondary" onClick={onSaveParameters} disabled={!project}>Save settings / 保存参数</Button>
          <Button variant="secondary" onClick={onReadParameters}>Load settings / 读取参数</Button>
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
        <ColorField
          label="Title color / 标题颜色"
          value={titleColor}
          onChange={onTitleColorChange}
          className="title-color-control"
          action={(
            <Button
              variant="ghost"
              aria-pressed={titleColorMode === "auto"}
              onClick={onUseAutoTitleColor}
            >
              Auto / 自动
            </Button>
          )}
        />
      </div>

      <div className="ui-card">
        <CardHeading title="LAYOUT / 每行小节数" />
        <SegmentedControl
          label="Measures per system / 每行小节数"
          columns={3}
          className="layout-options"
          options={[1, 2, 3].map((value) => ({ value, label: value }))}
          value={measuresPerSystem}
          onChange={onMeasuresPerSystemChange}
        />
      </div>

      <div className="ui-card ui-stack background-control">
        <div>
          <p className="step-label">BACKGROUND / 谱面背景</p>
        </div>
        <SegmentedControl
          label="Mask background mode / 蒙版背景模式"
          options={[
            { value: "image" as const, label: "Image / 图片", disabled: !project?.backgrounds.length },
            { value: "color" as const, label: "Color / 纯色" },
          ]}
          value={backgroundMode}
          onChange={onBackgroundModeChange}
        />
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
          <ColorField
            label="Background color / 背景颜色"
            value={backgroundColor}
            onChange={onBackgroundColorChange}
            ariaLabel="Mask background color / 蒙版背景颜色"
          />
        )}
        <SliderField
          label="Black mix / 黑色混入"
          value={maskBlackMixPercent}
          onChange={onMaskBlackMixPercentChange}
          ariaLabel="Mask black mix ratio / 蒙版黑色混入比例"
        />
        <SliderField
          label="Paper transparency / 谱纸透明度"
          value={paperTransparencyPercent}
          onChange={onPaperTransparencyPercentChange}
          ariaLabel="Light score paper transparency / 浅色谱纸透明度"
        />
      </div>

      <div className="ui-card ui-stack">
        <div>
          <p className="step-label">NOTE FRAME EFFECT / 音符帧效果</p>
        </div>
        <SliderField
          label="Mix strength / 混入强度"
          value={performanceMixPercent}
          onChange={onPerformanceMixPercentChange}
          ariaLabel="Shared note color mix strength / 共享音符着色混入强度"
        />
        <small>Shared by solid-color ranges; rainbow ranges always use full color. / 所有单色范围共用；彩虹色始终使用完整色彩。</small>
        <FrameColorRangeControl
          totalFrames={totalFrames}
          ranges={performanceColorRanges}
          onChange={onPerformanceColorRangesChange}
        />
      </div>

      <div className="ui-card ui-stack">
        <div>
          <p className="step-label">CONNECTED NOTES / 共享连杆音符</p>
        </div>
        <SegmentedControl
          label="Connected note mode / 共享连杆音符模式"
          options={[
            { value: "together" as const, label: "Fall together / 一并落下" },
            { value: "expand" as const, label: "Expand after falling / 落下后展开" },
          ]}
          value={connectedNoteMode}
          onChange={onConnectedNoteModeChange}
        />
        <small>Only affects eighth notes, sixteenth notes, and shorter notes sharing a beam. / 仅影响共享符尾连杆的八分、十六分及更短音符。</small>
      </div>
    </aside>
  );
}
