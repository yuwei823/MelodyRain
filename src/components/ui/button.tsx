import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "segment";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  compact?: boolean;
  round?: boolean;
  pill?: boolean;
}

export function Button({
  variant = "secondary",
  compact = false,
  round = false,
  pill = false,
  className,
  type,
  ...rest
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`];
  if (compact) classes.push("ui-button--compact");
  if (round) classes.push("ui-button--round");
  if (pill) classes.push("ui-button--pill");
  if (className) classes.push(className);
  return <button type={type ?? "button"} className={classes.join(" ")} {...rest} />;
}
