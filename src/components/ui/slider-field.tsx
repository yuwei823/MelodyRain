interface SliderFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  format?(value: number): string;
  className?: string;
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  format,
  className,
}: SliderFieldProps) {
  const classes = ["form-row", "form-row--range"];
  if (className) classes.push(className);
  return (
    <label className={classes.join(" ")}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel ?? label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{format ? format(value) : `${value}%`}</output>
    </label>
  );
}
