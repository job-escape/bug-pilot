import { getThread, getThreadBugs, skipBug, unskipBug, saveThreadContext } from "@/lib/db";
import { BugCard } from "@/components/BugCard";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const BOT_URL = process.env.BOT_URL || "http://localhost:3001";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ repo: string; id: string }>;
}) {
  const { repo, id } = await params;
  const repoName = decodeURIComponent(repo);
  const threadId = Number(id);

  const [thread, bugs] = await Promise.all([
    getThread(threadId),
    getThreadBugs(threadId),
  ]);

  if (!thread) notFound();

  const pendingCount = bugs.filter((b) => b.status === "pending").length;
  const canExecute = pendingCount > 0 && (thread.status === "pending" || thread.status === "in-progress");

  async function handleSaveContext(formData: FormData) {
    "use server";
    const context = String(formData.get("context") ?? "").trim();
    await saveThreadContext(threadId, context);
    revalidatePath(`/repos/${repo}/threads/${id}`);
  }

  async function handleSkip(formData: FormData) {
    "use server";
    const bugId = Number(formData.get("bugId"));
    await skipBug(bugId);
    revalidatePath(`/repos/${repo}/threads/${id}`);
  }

  async function handleUnskip(formData: FormData) {
    "use server";
    const bugId = Number(formData.get("bugId"));
    await unskipBug(bugId);
    revalidatePath(`/repos/${repo}/threads/${id}`);
  }

  async function handleExecute(formData: FormData) {
    "use server";
    await fetch(`${BOT_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
    revalidatePath(`/repos/${repo}/threads/${id}`);
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.05em" }}>
          repos
        </Link>
        <span style={{ color: "var(--text-dim)" }}>/</span>
        <Link href={`/repos/${encodeURIComponent(repo)}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.05em" }}>
          {repoName}
        </Link>
        <span style={{ color: "var(--text-dim)" }}>/</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text)", letterSpacing: "0.05em" }}>thread</span>
      </nav>

      {/* Thread header */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "24px",
        marginBottom: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
                fontWeight: 900,
                color: "var(--text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                margin: 0,
              }}>
                {thread.feature}
              </h1>
              <StatusBadge status={thread.status} />
            </div>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "12px",
              color: "var(--text-muted)",
              margin: 0,
              letterSpacing: "0.02em",
            }}>
              {thread.platform} · {thread.environment}
              {thread.build ? ` · build ${thread.build}` : ""}
              {" · "}{new Date(thread.parsed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <div style={{ display: "flex", gap: "24px", flexShrink: 0 }}>
            <Stat label="Bugs" value={thread.bug_count} />
            <Stat label="Fixed" value={thread.fixed_count} color="var(--accent)" />
            <Stat label="Unclear" value={thread.clarification_count} color="var(--accent-amber)" />
          </div>
        </div>

        {/* Links */}
        <div style={{ display: "flex", gap: "10px" }}>
          {thread.slack_permalink && (
            <a href={thread.slack_permalink} target="_blank" rel="noreferrer" style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              border: "1px solid var(--border)",
              borderRadius: "5px",
              padding: "5px 12px",
              letterSpacing: "0.04em",
            }}>
              slack thread ↗
            </a>
          )}
          {thread.pr_url && (
            <a href={thread.pr_url} target="_blank" rel="noreferrer" style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              color: "var(--accent)",
              textDecoration: "none",
              border: "1px solid var(--accent)33",
              borderRadius: "5px",
              padding: "5px 12px",
              letterSpacing: "0.04em",
              background: "var(--accent-dim)",
            }}>
              github pr ↗
            </a>
          )}
        </div>
      </div>

      {/* Context box + Execute row */}
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "24px",
        alignItems: "flex-start",
      }}>
        {/* Thread context */}
        <form action={handleSaveContext} style={{ flex: 1, display: "flex", gap: "8px" }}>
          <textarea
            name="context"
            defaultValue={thread.user_context ?? ""}
            placeholder="Add context for the bot (e.g. 'this is a new onboarding screen, the nav was added last sprint')…"
            rows={2}
            style={{
              flex: 1,
              fontFamily: "'DM Mono', monospace",
              fontSize: "12px",
              color: "var(--text)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              resize: "vertical",
              outline: "none",
              lineHeight: "1.5",
            }}
          />
          <button
            type="submit"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              padding: "8px 14px",
              cursor: "pointer",
              letterSpacing: "0.04em",
              alignSelf: "stretch",
            }}
          >
            save
          </button>
        </form>

        {/* Execute button */}
        {canExecute && (
          <form action={handleExecute}>
            <button
              type="submit"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "13px",
                fontWeight: 600,
                color: "#000",
                background: "var(--accent)",
                border: "none",
                borderRadius: "8px",
                padding: "12px 24px",
                cursor: "pointer",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              Execute →
            </button>
          </form>
        )}
      </div>

      {/* Bug cards */}
      {bugs.length === 0 ? (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "13px", color: "var(--text-muted)" }}>
          no bugs recorded
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {bugs.map((bug, i) => (
            <BugCard
              key={bug.id}
              bug={bug}
              index={i}
              skipAction={handleSkip}
              unskipAction={handleUnskip}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, color = "var(--text)" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "22px", fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-muted)", marginTop: "3px", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}
