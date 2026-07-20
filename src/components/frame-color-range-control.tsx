import { validFrameColorRanges, type FrameColorMode, type FrameColorRange } from "../lib/frame-color-ranges";

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
              <button className="ui-button ui-button--danger ui-button--compact" type="button"
                onClick={() => onChange(ranges.filter(({ id }) => id !== range.id))}>Remove / 删除</button>
            </div>
            <div className="frame-color-range-inputs">
              <label><span>Start / 起始</span><input type="number" min="1" max={Math.max(1, totalFrames)}
                value={range.startFrame + 1} onChange={(event) => update(range.id, { startFrame: Number(event.target.value) - 1 })} /></label>
              <label><span>End / 结束</span><input type="number" min="1" max={Math.max(1, totalFrames)}
                value={range.endFrame} onChange={(event) => update(range.id, { endFrame: Number(event.target.value) })} /></label>
            </div>
            <div className="segmented-control">
              {(["solid", "rainbow"] as FrameColorMode[]).map((mode) => (
                <button className="ui-button ui-button--segment" type="button" key={mode} aria-pressed={range.mode === mode}
                  onClick={() => update(range.id, { mode })}>{mode === "solid" ? "Solid / 单色" : "Rainbow / 彩虹色"}</button>
              ))}
            </div>
            {range.mode === "solid" && <label className="form-row form-row--color color-control">
              <span>Color / 颜色</span><input type="color" value={range.color}
                onChange={(event) => update(range.id, { color: event.target.value.toUpperCase() })} />
              <output>{range.color}</output>
            </label>}
          </div>
        ))}
      </div>
      <button className="ui-button ui-button--secondary" type="button" onClick={add}
        disabled={totalFrames <= 0}>Add frame range / 添加帧范围</button>
    </section>
  );
}
