"use server";

import { redirect, notFound } from "next/navigation";
import { getRepoConfigs, updateRepoConfig } from "@/lib/db";
import Link from "next/link";

export default async function RepoSettingsPage({ params }: { params: Promise<{ repo: string }> }) {
  const { repo } = await params;
  const repoName = decodeURIComponent(repo);
  const configs = await getRepoConfigs();
  const config = configs.find((r) => r.name === repoName);
  if (!config) notFound();

  async function save(formData: FormData) {
    "use server";
    const stackTagsRaw = formData.get("stack_tags") as string;
    const stackTags = stackTagsRaw ? stackTagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : config!.stack_tags;

    await updateRepoConfig(repoName, {
      github_owner: (formData.get("github_owner") as string) || config!.github_owner,
      base_branch: (formData.get("base_branch") as string) || "main",
      fix_model: (formData.get("fix_model") as string) || null,
      parser_model: (formData.get("parser_model") as string) || null,
      custom_prompt: (formData.get("custom_prompt") as string) || null,
      stack_tags: stackTags,
    });
    redirect(`/repos/${encodeURIComponent(repoName)}`);
  }

  return (
    <main style={{ minHeight: "100vh", padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <nav style={{ marginBottom: "2.5rem" }}>
        <Link href={`/repos/${encodeURIComponent(repoName)}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.05em" }}>
          ← {repoName}
        </Link>
      </nav>

      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2rem", fontWeight: 900, color: "var(--text)", marginBottom: "0.5rem", lineHeight: 1 }}>
        {repoName}
      </h1>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", marginBottom: "2rem" }}>
        repo settings
      </p>

      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href={`/repos/${encodeURIComponent(repoName)}/feature-memory`}
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)",
            border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 10px",
            textDecoration: "none", display: "inline-block",
          }}
        >
          ⚡ feature memory setup →
        </Link>
      </div>

      <form action={save} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field name="github_owner" label="GitHub Owner / Org" defaultValue={config.github_owner} />
          <Field name="base_branch" label="Base Branch" defaultValue={config.base_branch} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <SelectField
            name="fix_model"
            label="Fix Model"
            defaultValue={config.fix_model || "claude-sonnet-4-6"}
            hint="Model used to fix bugs"
            options={[
              { value: "claude-opus-4-7", label: "Opus 4.7 (best, slow)" },
              { value: "claude-sonnet-4-6", label: "Sonnet 4.6 (recommended)" },
              { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (fast, cheap)" },
            ]}
          />
          <SelectField
            name="parser_model"
            label="Parser Model"
            defaultValue={config.parser_model || "claude-haiku-4-5-20251001"}
            hint="Model used to parse Slack thread"
            options={[
              { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
              { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (recommended)" },
            ]}
          />
        </div>

        <div>
          <label style={labelStyle}>Custom Prompt Additions</label>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-dim)", marginBottom: "0.375rem" }}>
            Extra rules appended to the system prompt for this repo only.
          </p>
          <textarea
            name="custom_prompt"
            defaultValue={config.custom_prompt || ""}
            rows={5}
            placeholder="e.g. Always check src/api/ for backend errors."
            style={{
              width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "12px",
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
              color: "var(--text)", padding: "0.75rem", resize: "vertical", boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            fontFamily: "'DM Mono', monospace", fontSize: "13px", fontWeight: 500,
            background: "var(--accent)", color: "#000", border: "none",
            borderRadius: "8px", padding: "0.75rem 1.5rem", cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Save →
        </button>
      </form>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.08em",
  color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.375rem",
};

function Field({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        style={{
          width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "13px",
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box",
        }}
      />
      {hint && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-dim)", marginTop: "0.375rem" }}>{hint}</p>}
    </div>
  );
}

function SelectField({ name, label, defaultValue, options, hint }: {
  name: string; label: string; defaultValue?: string; hint?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        style={{
          width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "13px",
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box",
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-dim)", marginTop: "0.375rem" }}>{hint}</p>}
    </div>
  );
}
