import type { ReactNode } from "react";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  ariaLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ColorField({ label, value, onChange, ariaLabel, action, className }: ColorFieldProps) {
  const classes = ["form-row", action ? "form-row--color-action" : "form-row--color", "color-control"];
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")}>
      <span>{label}</span>
      <input
        type="color"
        value={value}
        aria-label={ariaLabel ?? label}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
      <output>{value.toUpperCase()}</output>
      {action}
    </div>
  );
}
