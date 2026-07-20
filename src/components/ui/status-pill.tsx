interface StatusPillProps {
  message: string;
  isError?: boolean;
}

export function StatusPill({ message, isError = false }: StatusPillProps) {
  return (
    <div className={`status-pill ${isError ? "is-error" : ""}`} role="status">
      <span className="status-dot" />
      {message}
    </div>
  );
}
