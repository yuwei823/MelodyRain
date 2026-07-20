import type { ReactNode } from "react";

interface CardHeadingProps {
  title: string;
  status?: ReactNode;
  id?: string;
}

export function CardHeading({ title, status, id }: CardHeadingProps) {
  return (
    <div className="card-heading">
      <p className="step-label" id={id}>{title}</p>
      {status != null && <span>{status}</span>}
    </div>
  );
}
