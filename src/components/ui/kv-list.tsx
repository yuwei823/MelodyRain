import type { ReactNode } from "react";

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
}

interface KeyValueListProps {
  items: ReadonlyArray<KeyValueItem>;
  /** boxed: inset panel background; large: roomier rows; columns: fixed label column with ellipsis. */
  variant?: "plain" | "boxed" | "large" | "columns";
  ariaLabel?: string;
  className?: string;
}

export function KeyValueList({ items, variant = "plain", ariaLabel, className }: KeyValueListProps) {
  const classes = ["kv-list"];
  if (variant !== "plain") classes.push(`kv-list--${variant}`);
  if (className) classes.push(className);
  return (
    <div className={classes.join(" ")} aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div key={index}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
