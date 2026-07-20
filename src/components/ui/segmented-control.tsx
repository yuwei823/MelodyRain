import type { ReactNode } from "react";
import { Button } from "./button";

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange(value: T): void;
  columns?: 2 | 3;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const classes = ["segmented-control"];
  if (columns === 3) classes.push("segmented-control--three");
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")} aria-label={label}>
      {options.map((option) => (
        <Button
          variant="segment"
          key={String(option.value)}
          aria-pressed={value === option.value}
          disabled={disabled || option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
