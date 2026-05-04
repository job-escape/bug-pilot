import { readFileSync } from "fs";
import { join } from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepoConfigs, getSettings } from "@/lib/db";
import { CopyButton } from "./CopyButton";

export default async function FeatureMemoryPage({ params }: { params: Promise<{ repo: string }> }) {
  const { repo } = await params;
  const repoName = decodeURIComponent(repo);

  const [configs, settings] = await Promise.all([
    getRepoConfigs().catch(() => [] as Awaited<ReturnType<typeof getRepoConfigs>>),
    getSettings().catch(() => ({} as Record<string, string>)),
  ]);

  const config = configs.find((r) => r.name === repoName);
  if (!config) notFound();

  const workflowContent = readFileSync(
    join(process.cwd(), "../src/github/feature-memory/workflow.yml"),
    "utf8"
  );
  const scriptContent = readFileSync(
    join(process.cwd(), "../src/github/feature-memory/generate-manifest.mjs"),
    "utf8"
  );

  const apiKey = settings.anthropic_api_key ?? "";
  const maskedKey = apiKey ? `${apiKey.slice(0, 10)}${"•".repeat(20)}` : "(not set)";

  const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };
  const stepLabel: React.CSSProperties = {
    ...mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--text-dim)", marginBottom: "0.75rem",
  };
  const card: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "10px", padding: "1.25rem 1.5rem",
  };
  const codeArea: React.CSSProperties = {
    ...mono, fontSize: "11px", color: "var(--text-muted)",
    background: "color-mix(in srgb, var(--card) 60%, transparent)",
    border: "1px solid var(--border)", borderRadius: "8px",
    padding: "0.75rem", width: "100%", resize: "vertical",
    boxSizing: "border-box", lineHeight: 1.6, outline: "none",
  };

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <nav style={{ marginBottom: "2.5rem" }}>
        <Link
          href={`/repos/${encodeURIComponent(repoName)}/settings`}
          style={{ ...mono, fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.05em" }}
        >
          ← {repoName} / settings
        </Link>
      </nav>

      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2rem", fontWeight: 900, color: "var(--text)", marginBottom: "0.5rem", lineHeight: 1 }}>
        feature memory
      </h1>
      <p style={{ ...mono, fontSize: "12px", color: "var(--text-muted)", marginBottom: "2.5rem", lineHeight: 1.6 }}>
        Automatically documents every merged PR so the bot understands your codebase when fixing bugs.
        Each PR generates a <code style={{ color: "var(--text)", background: "color-mix(in srgb, var(--border) 60%, transparent)", padding: "1px 5px", borderRadius: "3px" }}>.feature-memory/*.md</code> file the bot reads before fixing.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Step 1 */}
        <div style={card}>
          <p style={stepLabel}>Step 1 — Create GitHub Actions workflow</p>
          <p style={{ ...mono, fontSize: "11px", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            Create file: <code style={{ color: "var(--text)" }}>.github/workflows/feature-memory.yml</code>
          </p>
          <div style={{ position: "relative" }}>
            <textarea readOnly value={workflowContent} rows={10} style={codeArea} />
            <CopyButton value={workflowContent} />
          </div>
        </div>

        {/* Step 2 */}
        <div style={card}>
          <p style={stepLabel}>Step 2 — Create generator script</p>
          <p style={{ ...mono, fontSize: "11px", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            Create file: <code style={{ color: "var(--text)" }}>.github/scripts/generate-manifest.mjs</code>
          </p>
          <div style={{ position: "relative" }}>
            <textarea readOnly value={scriptContent} rows={12} style={codeArea} />
            <CopyButton value={scriptContent} />
          </div>
        </div>

        {/* Step 3 */}
        <div style={card}>
          <p style={stepLabel}>Step 3 — Add GitHub Secret</p>
          <p style={{ ...mono, fontSize: "11px", color: "var(--text-muted)", marginBottom: "1rem" }}>
            In your GitHub repo: <strong style={{ color: "var(--text)" }}>Settings → Secrets and variables → Actions → New repository secret</strong>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.75rem", alignItems: "center" }}>
            <span style={{ ...mono, fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Name</span>
            <code style={{ ...mono, fontSize: "12px", color: "var(--text)", background: "color-mix(in srgb, var(--border) 60%, transparent)", padding: "6px 10px", borderRadius: "6px" }}>
              ANTHROPIC_API_KEY
            </code>
            <CopyButton value="ANTHROPIC_API_KEY" small />

            <span style={{ ...mono, fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Value</span>
            <code style={{ ...mono, fontSize: "12px", color: "var(--text-muted)", background: "color-mix(in srgb, var(--border) 60%, transparent)", padding: "6px 10px", borderRadius: "6px" }}>
              {maskedKey}
            </code>
            <CopyButton value={apiKey} small disabled={!apiKey} />
          </div>
          {!apiKey && (
            <p style={{ ...mono, fontSize: "10px", color: "var(--accent-amber)", marginTop: "0.75rem" }}>
              Anthropic API key not found. Add it in{" "}
              <Link href="/settings" style={{ color: "var(--accent-amber)" }}>Global Settings</Link>.
            </p>
          )}
        </div>

        {/* Done */}
        <div style={{ ...card, borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "color-mix(in srgb, var(--accent) 4%, transparent)" }}>
          <p style={{ ...mono, fontSize: "11px", color: "var(--accent)", marginBottom: "0.25rem", letterSpacing: "0.05em" }}>
            ✓ done
          </p>
          <p style={{ ...mono, fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Merge any PR — a <code style={{ color: "var(--text)" }}>.feature-memory/*.md</code> file will appear automatically. The bot reads these files before fixing bugs in that feature area.
          </p>
        </div>

      </div>
    </main>
  );
}
