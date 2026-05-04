const config: Record<string, { label: string; color: string; dot: string }> = {
  fixed:                 { label: "fixed",       color: "var(--accent)",       dot: "#00ff87" },
  "needs-clarification": { label: "unclear",      color: "var(--accent-amber)", dot: "#f59e0b" },
  "not-found":           { label: "not found",    color: "var(--accent-red)",   dot: "#ef4444" },
  "in-progress":         { label: "in progress",  color: "var(--accent-blue)",  dot: "#60a5fa" },
  done:                  { label: "done",          color: "var(--accent)",       dot: "#00ff87" },
  "no-fixes":            { label: "no fixes",     color: "var(--text-muted)",   dot: "#555" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status] ?? { label: status, color: "var(--text-muted)", dot: "#555" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      fontFamily: "'DM Mono', monospace",
      fontSize: "11px",
      color: c.color,
      letterSpacing: "0.05em",
      padding: "2px 8px",
      borderRadius: "4px",
      border: `1px solid ${c.dot}33`,
      background: `${c.dot}0d`,
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: "5px",
        height: "5px",
        borderRadius: "50%",
        background: c.dot,
        display: "inline-block",
        boxShadow: `0 0 5px ${c.dot}`,
        flexShrink: 0,
      }} />
      {c.label}
    </span>
  );
}
