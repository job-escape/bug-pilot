import { getRepos } from "@/lib/db";
import type { RepoSummary } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repos = await getRepos();

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="mb-12 pt-4">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                v0.1
              </span>
              <span style={{ color: "var(--border-hover)" }}>·</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "11px", letterSpacing: "0.2em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                QA AUTO-FIX
              </span>
            </div>
            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 900,
              letterSpacing: "-0.01em",
              lineHeight: 1,
              color: "var(--text)",
            }}>
              bug<span style={{ color: "var(--accent)" }}>·</span>pilot
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
            <Link href="/settings" style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--text-muted)", textDecoration: "none", whiteSpace: "nowrap", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px" }}>
              ⚙ settings
            </Link>
            <Link href="/setup" style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
              + add repo
            </Link>
          </div>
        </div>
      </header>

      {repos.length === 0 ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "3rem 2.5rem", textAlign: "center", background: "var(--bg-card)" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>
            no repositories
          </div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, maxWidth: "360px", margin: "0 auto 2rem" }}>
            Add a repo to start auto-fixing QA bugs from Slack.
          </p>
          <Link href="/setup" style={{ fontFamily: "'DM Mono', monospace", fontSize: "13px", fontWeight: 500, background: "var(--accent)", color: "#000", borderRadius: "8px", padding: "0.75rem 1.5rem", textDecoration: "none", display: "inline-block" }}>
            Add your first repo →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          {repos.map((repo, i) => (
            <RepoRow key={repo.repo} repo={repo} index={i} total={repos.length} />
          ))}
        </div>
      )}
    </main>
  );
}

function RepoRow({ repo, index, total }: { repo: RepoSummary; index: number; total: number }) {
  const bugTotal = repo.bug_count || 1;
  const fixedPct = (repo.fixed_count / bugTotal) * 100;
  const unclearPct = (repo.clarification_count / bugTotal) * 100;
  const notFoundPct = (repo.not_found_count / bugTotal) * 100;

  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Link
      href={`/repos/${encodeURIComponent(repo.repo)}`}
      className="group"
      style={{
        display: "block",
        background: "var(--bg-card)",
        borderRadius: isFirst ? "11px 11px 0 0" : isLast ? "0 0 11px 11px" : "0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        padding: "20px 24px",
        transition: "background 0.15s ease",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        {/* Repo name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "0.01em",
            }}>
              {repo.repo}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)" }}>
              {repo.thread_count} thread{repo.thread_count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: "3px",
            borderRadius: "2px",
            background: "var(--border)",
            overflow: "hidden",
            display: "flex",
            maxWidth: "320px",
          }}>
            {fixedPct > 0 && <div style={{ width: `${fixedPct}%`, background: "var(--accent)", height: "100%", transition: "width 0.3s ease" }} />}
            {unclearPct > 0 && <div style={{ width: `${unclearPct}%`, background: "var(--accent-amber)", height: "100%" }} />}
            {notFoundPct > 0 && <div style={{ width: `${notFoundPct}%`, background: "var(--accent-red)", height: "100%" }} />}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "28px", shrink: 0 } as React.CSSProperties}>
          <Pill label="bugs" value={repo.bug_count} />
          <Pill label="fixed" value={repo.fixed_count} accent="var(--accent)" />
          <Pill label="unclear" value={repo.clarification_count} accent="var(--accent-amber)" />
        </div>

        {/* Date + arrow */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)" }}>
            {new Date(repo.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}>→</span>
        </div>
      </div>
    </Link>
  );
}

function Pill({ label, value, accent = "var(--text)" }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "20px", fontWeight: 500, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", letterSpacing: "0.05em" }}>
        {label}
      </div>
    </div>
  );
}
