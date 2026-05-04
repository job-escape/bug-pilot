import type { Bug } from "@/lib/db";

const statusMeta: Record<string, { label: string; color: string; dot: string }> = {
  fixed:                 { label: "fixed",       color: "var(--accent)",       dot: "#00ff87" },
  "needs-clarification": { label: "unclear",      color: "var(--accent-amber)", dot: "#f59e0b" },
  "not-found":           { label: "not found",    color: "var(--accent-red)",   dot: "#ef4444" },
  pending:               { label: "pending",      color: "var(--text-muted)",   dot: "#555" },
  skipped:               { label: "skipped",      color: "var(--text-dim)",     dot: "#333" },
};

export function BugCard({
  bug,
  index,
  skipAction,
  unskipAction,
}: {
  bug: Bug;
  index: number;
  skipAction?: (formData: FormData) => Promise<void>;
  unskipAction?: (formData: FormData) => Promise<void>;
}) {
  const meta = statusMeta[bug.status] ?? { label: bug.status, color: "var(--text-muted)", dot: "#555" };
  const isSkipped = bug.status === "skipped";
  const isPending = bug.status === "pending";

  return (
    <div
      className="card-enter"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${meta.dot}`,
        borderRadius: "8px",
        overflow: "hidden",
        animationDelay: `${index * 0.04}s`,
        opacity: isSkipped ? 0.45 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
        }}>
          #{String(index + 1).padStart(2, "0")}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Skip / Unskip button — only for pending/skipped bugs */}
          {(isPending || isSkipped) && (isSkipped ? unskipAction : skipAction) && (
            <form action={isSkipped ? unskipAction : skipAction}>
              <input type="hidden" name="bugId" value={bug.id} />
              <button
                type="submit"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "10px",
                  color: isSkipped ? "var(--text-muted)" : "var(--text-dim)",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                {isSkipped ? "unskip" : "skip"}
              </button>
            </form>
          )}

          <span style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "11px",
            color: meta.color,
            letterSpacing: "0.08em",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: meta.dot,
              display: "inline-block",
              boxShadow: `0 0 6px ${meta.dot}`,
            }} />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex" }}>
        {/* Left: bug report */}
        <div style={{ flex: 1, padding: "16px", borderRight: "1px solid var(--border)", minWidth: 0 }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "13px",
            lineHeight: "1.6",
            color: "var(--text)",
            margin: 0,
          }}>
            {bug.text || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>no description</span>}
          </p>

          {(() => {
            const imgs = bug.image_urls?.length ? bug.image_urls : bug.image_url ? [bug.image_url] : [];
            if (!imgs.length) return null;
            return (
              <details style={{ marginTop: "12px" }}>
                <summary style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  userSelect: "none",
                }}>
                  {imgs.length === 1 ? "screenshot ▾" : `${imgs.length} screenshots ▾`}
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                  {imgs.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      style={{
                        maxHeight: "180px",
                        borderRadius: "4px",
                        border: "1px solid var(--border)",
                        objectFit: "contain",
                      }}
                    />
                  ))}
                </div>
              </details>
            );
          })()}

          {bug.slack_permalink && (
            <a
              href={bug.slack_permalink}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                marginTop: "12px",
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                color: "var(--text-muted)",
                textDecoration: "none",
                letterSpacing: "0.03em",
                transition: "color 0.15s",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              slack
            </a>
          )}
        </div>

        {/* Right: analysis */}
        <div style={{ width: "220px", flexShrink: 0, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {bug.rationale && (
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "12px",
              lineHeight: "1.55",
              color: "var(--text-muted)",
              margin: 0,
              flex: 1,
            }}>
              {bug.rationale}
            </p>
          )}
          {bug.file_path && (
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "11px",
                color: "var(--accent-blue)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: "auto",
              }}
              title={`${bug.file_path}${bug.line_range ? `:${bug.line_range}` : ""}`}
            >
              {bug.file_path}{bug.line_range ? `:${bug.line_range}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
