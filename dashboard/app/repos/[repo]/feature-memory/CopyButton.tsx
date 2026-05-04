"use client";

import { useState } from "react";

export function CopyButton({ value, small, disabled }: { value: string; small?: boolean; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (disabled) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const size = small ? { fontSize: "10px", padding: "4px 8px" } : { fontSize: "11px", padding: "5px 12px" };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      style={{
        fontFamily: "'DM Mono', monospace",
        ...size,
        background: copied ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
        color: copied ? "var(--accent)" : disabled ? "var(--text-dim)" : "var(--text-muted)",
        border: "1px solid",
        borderColor: copied ? "var(--accent)" : "var(--border)",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        ...(small ? {} : { position: "absolute", top: "8px", right: "8px" }),
      }}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}
