import { getThreadsByRepo, getRepoConfigs, setActiveRepo, deactivateAllRepos } from "@/lib/db";
import type { Thread } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const revalidate = 30;

export default async function RepoPage({ params }: { params: Promise<{ repo: string }> }) {
  const { repo } = await params;
  const repoName = decodeURIComponent(repo);
  const [threads, repoConfigs] = await Promise.all([
    getThreadsByRepo(repoName),
    getRepoConfigs().catch(() => []),
  ]);
  const repoConfig = repoConfigs.find((r) => r.name === repoName);
  const isActive = repoConfig?.is_active ?? false;

  async function activateRepo() {
    "use server";
    await setActiveRepo(repoName);
    redirect(`/repos/${encodeURIComponent(repoName)}`);
  }

  async function deactivateRepo() {
    "use server";
    await deactivateAllRepos();
    redirect(`/repos/${encodeURIComponent(repoName)}`);
  }

  if (!repoConfig) notFound();

  const totalBugs = threads.reduce((s, t) => s + t.bug_count, 0);
  const totalFixed = threads.reduce((s, t) => s + t.fixed_count, 0);
  const totalUnclear = threads.reduce((s, t) => s + t.clarification_count, 0);

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav style={{ marginBottom: "40px" }}>
        <Link href="/" style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          textDecoration: "none",
          letterSpacing: "0.05em",
        }}>
          ← repos
        </Link>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontWeight: 900,
          color: "var(--text)",
          letterSpacing: "-0.01em",
          lineHeight: 1,
          marginBottom: "16px",
        }}>
          {repoName}
        </h1>
        <div style={{ display: "flex", gap: "28px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <Metric label="threads" value={threads.length} />
          <Metric label="bugs" value={totalBugs} />
          <Metric label="fixed" value={totalFixed} color="var(--accent)" />
          {totalUnclear > 0 && <Metric label="unclear" value={totalUnclear} color="var(--accent-amber)" />}
          {repoConfig && (
            isActive ? (
              <form action={deactivateRepo} style={{ display: "inline" }}>
                <button type="submit" title="Click to deactivate" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: "6px", padding: "4px 10px", background: "transparent", cursor: "pointer", opacity: 0.8 }}>
                  ✓ active
                </button>
              </form>
            ) : (
              <form action={activateRepo} style={{ display: "inline" }}>
                <button type="submit" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", background: "transparent", cursor: "pointer" }}>
                  set as active
                </button>
              </form>
            )
          )}
          <Link
            href={`/repos/${encodeURIComponent(repoName)}/settings`}
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", textDecoration: "none" }}
          >
            ⚙ settings
          </Link>
        </div>
      </div>

      {/* Thread list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        {threads.map((thread, i) => (
          <ThreadRow key={thread.id} thread={thread} repo={repoName} index={i} total={threads.length} />
        ))}
      </div>
    </main>
  );
}

function ThreadRow({ thread, repo, index, total }: { thread: Thread; repo: string; index: number; total: number }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Link
      href={`/repos/${encodeURIComponent(repo)}/threads/${thread.id}`}
      className="group"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 20px",
        background: "var(--bg-card)",
        borderRadius: isFirst ? "9px 9px 0 0" : isLast ? "0 0 9px 9px" : "0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        textDecoration: "none",
        transition: "background 0.12s ease",
      }}
    >
      {/* Feature + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {thread.feature}
          </span>
          <StatusBadge status={thread.status} />
        </div>
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          margin: 0,
          letterSpacing: "0.02em",
        }}>
          {thread.platform} · {thread.environment}
          {thread.build ? ` · build ${thread.build}` : ""}
          {" · "}{new Date(thread.parsed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Stats + PR */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "16px", fontWeight: 500, color: "var(--text)", lineHeight: 1 }}>{thread.bug_count}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>bugs</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "16px", fontWeight: 500, color: "var(--accent)", lineHeight: 1 }}>{thread.fixed_count}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>fixed</div>
        </div>
        {thread.pr_url && (
          <a
            href={thread.pr_url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "3px 8px",
              letterSpacing: "0.03em",
              transition: "color 0.12s, border-color 0.12s",
            }}
          >
            PR ↗
          </a>
        )}
        <span style={{ color: "var(--text-dim)", fontSize: "14px" }}>→</span>
      </div>
    </Link>
  );
}

function Metric({ label, value, color = "var(--text)" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "24px", fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}
