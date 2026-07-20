import { validFrameColorRanges, type FrameColorMode, type FrameColorRange } from "../lib/frame-color-ranges";
import { Button } from "./ui/button";
import { ColorField } from "./ui/color-field";
import { SegmentedControl } from "./ui/segmented-control";

interface FrameColorRangeControlProps {
  totalFrames: number;
  ranges: FrameColorRange[];
  onChange(value: FrameColorRange[]): void;
}

export function FrameColorRangeControl({ totalFrames, ranges,
  onChange }: FrameColorRangeControlProps) {
  const update = (id: string, patch: Partial<FrameColorRange>) => {
    const next = ranges.map((range) => range.id === id ? { ...range, ...patch } : range);
    if (validFrameColorRanges(next, totalFrames)) onChange(next);
  };
  const add = () => {
    const lastEnd = ranges.reduce((end, range) => Math.max(end, range.endFrame), 0);
    const startFrame = Math.min(lastEnd, Math.max(0, totalFrames - 1));
    const endFrame = Math.min(totalFrames, startFrame + Math.max(1, Math.round(totalFrames / 4)));
    const next = [...ranges, { id: crypto.randomUUID(), startFrame, endFrame,
      mode: "rainbow" as const, color: "#1CAEE8" }];
    if (validFrameColorRanges(next, totalFrames)) onChange(next);
  };
  return (
    <section className="ui-stack frame-color-range-control">
      <div className="frame-color-range-divider">
        <strong>Frame ranges / 帧范围</strong>
        <span>Frames 1–{totalFrames || "—"} / 帧</span>
      </div>
      <div className="frame-color-range-list">
        {ranges.map((range, index) => (
          <div className="frame-color-range-item" key={range.id}>
            <div className="frame-color-range-heading">
              <strong>Range {index + 1} / 范围 {index + 1}</strong>
              <Button variant="danger" compact
                onClick={() => onChange(ranges.filter(({ id }) => id !== range.id))}>Remove / 删除</Button>
            </div>
            <div className="frame-range-fields">
              <label>
                <span>Start frame / 起始帧</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={range.startFrame + 1}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (/^\d+$/.test(raw)) update(range.id, { startFrame: Number(raw) - 1 });
                  }}
                />
              </label>
              <label>
                <span>End frame / 结束帧</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={range.endFrame}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (/^\d+$/.test(raw)) update(range.id, { endFrame: Number(raw) });
                  }}
                />
              </label>
            </div>
            <SegmentedControl
              label="Range color mode / 范围着色模式"
              options={(["solid", "rainbow"] as FrameColorMode[]).map((mode) => ({
                value: mode,
                label: mode === "solid" ? "Solid / 单色" : "Rainbow / 彩虹色",
              }))}
              value={range.mode}
              onChange={(mode) => update(range.id, { mode })}
            />
            {range.mode === "solid" && (
              <ColorField
                label="Color / 颜色"
                value={range.color}
                onChange={(color) => update(range.id, { color })}
              />
            )}
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={add}
        disabled={totalFrames <= 0}>Add frame range / 添加帧范围</Button>
    </section>
  );
}
