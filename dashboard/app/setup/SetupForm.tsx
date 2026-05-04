"use client";

import { useState, useRef, useEffect } from "react";

const STACK_OPTIONS: Record<string, { level1: string[]; level2: Record<string, string[]> }> = {
  frontend: {
    level1: ["React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte"],
    level2: {
      React: ["TypeScript", "Tailwind", "CSS Modules", "Redux", "Zustand", "React Query", "Effector", "Jotai", "MobX", "GraphQL", "tRPC"],
      "Next.js": ["TypeScript", "Tailwind", "CSS Modules", "Prisma", "tRPC", "React Query", "Zustand", "GraphQL"],
      Vue: ["TypeScript", "Pinia", "Vuex", "Tailwind", "GraphQL"],
      Nuxt: ["TypeScript", "Tailwind", "Pinia", "GraphQL"],
      Angular: ["TypeScript", "RxJS", "NgRx", "Tailwind", "GraphQL"],
      Svelte: ["TypeScript", "SvelteKit", "Tailwind"],
    },
  },
  backend: {
    level1: ["Node.js/Express", "Python/Django", "Python/FastAPI", "Go", "Ruby/Rails", "Java/Spring"],
    level2: {
      "Node.js/Express": ["TypeScript", "PostgreSQL", "MongoDB", "Redis", "Prisma", "JWT", "GraphQL", "tRPC"],
      "Python/Django": ["PostgreSQL", "Redis", "Celery", "DRF", "JWT", "GraphQL"],
      "Python/FastAPI": ["PostgreSQL", "Redis", "SQLAlchemy", "Pydantic", "JWT", "Celery"],
      Go: ["PostgreSQL", "Redis", "GORM", "chi", "gin", "gRPC"],
      "Ruby/Rails": ["PostgreSQL", "Redis", "Sidekiq", "Devise", "GraphQL"],
      "Java/Spring": ["PostgreSQL", "Redis", "Maven", "Gradle", "JWT", "Kafka"],
    },
  },
  mobile: {
    level1: ["React Native", "Flutter", "Expo", "Swift/iOS", "Kotlin/Android"],
    level2: {
      "React Native": ["TypeScript", "Expo", "Expo Router", "React Navigation", "Redux", "Zustand", "Effector", "farfetched", "React Query", "NativeWind", "Tailwind", "Reanimated", "MMKV"],
      Flutter: ["Riverpod", "Provider", "Bloc", "GoRouter", "Dio", "Freezed"],
      Expo: ["TypeScript", "Expo Router", "React Navigation", "Zustand", "Effector", "NativeWind", "Reanimated"],
      "Swift/iOS": ["SwiftUI", "UIKit", "Combine", "CoreData", "TCA"],
      "Kotlin/Android": ["Jetpack Compose", "ViewModel", "Room", "Retrofit", "Hilt", "Coroutines"],
    },
  },
  data: {
    level1: ["Python", "Python/FastAPI", "Jupyter", "dbt"],
    level2: {
      Python: ["PyTorch", "TensorFlow", "Pandas", "NumPy", "scikit-learn", "FastAPI", "LangChain"],
      "Python/FastAPI": ["Pydantic", "SQLAlchemy", "PostgreSQL", "Redis", "Celery"],
      Jupyter: ["Pandas", "NumPy", "Matplotlib", "Seaborn", "PyTorch", "TensorFlow"],
      dbt: ["PostgreSQL", "BigQuery", "Snowflake", "Redshift"],
    },
  },
};

// Heuristic parser for README/CLAUDE.md
function parseMarkdownStack(text: string): { repoType: string; l1: string[]; l2: string[] } {
  const lower = text.toLowerCase();
  let repoType = "frontend";
  const l1: string[] = [];
  const l2: string[] = [];

  // L1: detect primary framework — most specific first, frontend before backend
  if (lower.includes("react native") || (lower.includes("expo") && !lower.includes("next"))) {
    repoType = "mobile";
    l1.push("React Native");
    if (lower.includes("expo")) l1.push("Expo");
  } else if (lower.includes("flutter")) {
    repoType = "mobile"; l1.push("Flutter");
  } else if (lower.includes("swift") && (lower.includes("ios") || lower.includes("swiftui"))) {
    repoType = "mobile"; l1.push("Swift/iOS");
  } else if (lower.includes("kotlin") && lower.includes("android")) {
    repoType = "mobile"; l1.push("Kotlin/Android");
  } else if (lower.includes("next.js") || lower.includes("nextjs") || lower.includes("next-js") || lower.includes("\"nextjs\"") || lower.includes("app-router") || lower.includes("app router")) {
    // Next.js before backend checks — it has server code but is frontend
    repoType = "frontend"; l1.push("Next.js");
  } else if (lower.includes("nuxt")) {
    repoType = "frontend"; l1.push("Nuxt");
  } else if (lower.includes("fastapi")) {
    repoType = "backend"; l1.push("Python/FastAPI");
  } else if (lower.includes("django")) {
    repoType = "backend"; l1.push("Python/Django");
  } else if (lower.includes("express") || lower.includes("node.js")) {
    repoType = "backend"; l1.push("Node.js/Express");
  } else if (lower.includes("golang") || lower.includes("go.mod") || lower.includes("go.sum") || /\bgo (lang|module|routine|fiber|gin|chi|echo)\b/.test(lower)) {
    // Strict Go detection — avoid matching "go" as a verb in English text
    repoType = "backend"; l1.push("Go");
  } else if (lower.includes("rails")) {
    repoType = "backend"; l1.push("Ruby/Rails");
  } else if (lower.includes("spring")) {
    repoType = "backend"; l1.push("Java/Spring");
  } else if (lower.includes("react")) {
    repoType = "frontend"; l1.push("React");
  } else if (lower.includes("vue")) {
    repoType = "frontend"; l1.push("Vue");
  } else if (lower.includes("angular")) {
    repoType = "frontend"; l1.push("Angular");
  } else if (lower.includes("svelte")) {
    repoType = "frontend"; l1.push("Svelte");
  } else if (lower.includes("pytorch") || lower.includes("tensorflow") || lower.includes("pandas")) {
    repoType = "data"; l1.push("Python");
  }

  // L2: detect additional technologies
  if (lower.includes("typescript")) l2.push("TypeScript");
  if (lower.includes("tailwind") || lower.includes("nativewind")) l2.push(repoType === "mobile" ? "NativeWind" : "Tailwind");
  if (lower.includes("postgresql") || lower.includes("postgres")) l2.push("PostgreSQL");
  if (lower.includes("redis")) l2.push("Redis");
  if (lower.includes("prisma")) l2.push("Prisma");
  if (lower.includes("graphql")) l2.push("GraphQL");
  if (lower.includes("redux")) l2.push("Redux");
  if (lower.includes("zustand")) l2.push("Zustand");
  if (lower.includes("effector")) l2.push("Effector");
  if (lower.includes("farfetched") || lower.includes("@farfetched")) l2.push("farfetched");
  if (lower.includes("react query") || lower.includes("tanstack query")) l2.push("React Query");
  if (lower.includes("trpc")) l2.push("tRPC");
  if (lower.includes("mobx")) l2.push("MobX");
  if (lower.includes("jotai")) l2.push("Jotai");
  if (lower.includes("reanimated")) l2.push("Reanimated");
  if (lower.includes("expo router")) l2.push("Expo Router");
  if (lower.includes("react navigation")) l2.push("React Navigation");
  if (lower.includes("mmkv")) l2.push("MMKV");
  if (lower.includes("zod")) l2.push("Zod");
  if (lower.includes("celery")) l2.push("Celery");
  if (lower.includes("mongodb")) l2.push("MongoDB");
  if (lower.includes("grpc")) l2.push("gRPC");
  if (lower.includes("kafka")) l2.push("Kafka");
  if (lower.includes("langchain")) l2.push("LangChain");

  return { repoType, l1, l2 };
}

export default function SetupForm() {
  const [tab, setTab] = useState<"guided" | "upload">("guided");
  const [repoType, setRepoType] = useState("frontend");
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [selectedL2, setSelectedL2] = useState<string[]>([]);
  const [customChips, setCustomChips] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Repo picker state
  const [org, setOrg] = useState("job-escape");
  const [repoName, setRepoName] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState("");

  const loadRepos = async () => {
    if (!org.trim()) return;
    setReposLoading(true);
    setReposError("");
    setRepos([]);
    try {
      const res = await fetch(`/api/github-repos?org=${encodeURIComponent(org.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setRepos(data.repos);
    } catch {
      setReposError("Could not load repos. Check the org/user name.");
    } finally {
      setReposLoading(false);
    }
  };

  // Auto-load repos for default org on mount
  useEffect(() => { loadRepos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const options = STACK_OPTIONS[repoType] ?? STACK_OPTIONS.frontend!;
  const allStackTags = [...selectedL1, ...selectedL2, ...customChips].join(",");

  // Prompt preview state
  const [promptPreview, setPromptPreview] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Refresh preview when stack changes (only if preview is open)
  useEffect(() => {
    if (!showPrompt) return;
    let cancelled = false;
    setPromptLoading(true);
    const params = new URLSearchParams({ repo_type: repoType, stack_tags: allStackTags });
    fetch(`/api/prompt-preview?${params}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setPromptPreview(data.prompt ?? ""); })
      .catch(() => { if (!cancelled) setPromptPreview("Failed to load preview."); })
      .finally(() => { if (!cancelled) setPromptLoading(false); });
    return () => { cancelled = true; };
  }, [repoType, allStackTags, showPrompt]);

  const [detectHint, setDetectHint] = useState<"none" | "ok" | "failed">("none");

  const applyParsed = (text: string) => {
    const parsed = parseMarkdownStack(text);
    setRepoType(parsed.repoType);
    setSelectedL1(parsed.l1);
    setSelectedL2(parsed.l2);
    setDetectHint(parsed.l1.length === 0 ? "failed" : "ok");
    setTab("guided");
  };

  const handleFile = (file: File) => {
    file.text().then((text) => { setUploadText(text); applyParsed(text); });
  };

  const toggleL1 = (chip: string) => {
    setSelectedL1((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
    // Clear L2 selections for deselected L1
    if (selectedL1.includes(chip)) {
      const l2ForChip = options.level2[chip] ?? [];
      setSelectedL2((prev) => prev.filter((c) => !l2ForChip.includes(c)));
    }
  };

  const toggleL2 = (chip: string) => {
    setSelectedL2((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (val && !customChips.includes(val)) {
      setCustomChips((prev) => [...prev, val]);
      setCustomInput("");
    }
  };

  // Exclude chips that are already selected as L1 frameworks (e.g. "Expo" when Expo is in L1)
  const availableL2 = [...new Set(selectedL1.flatMap((l1) => options.level2[l1] ?? []))].filter(
    (chip) => !options.level1.includes(chip)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <input type="hidden" name="repo_type" value={repoType} />
      <input type="hidden" name="stack_tags" value={allStackTags} />
      <input type="hidden" name="github_owner" value={org} />
      <input type="hidden" name="repo_name" value={repoName} />

      {/* Org + repo picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
              GitHub Owner / Org
            </label>
            <input
              type="text"
              value={org}
              onChange={(e) => { setOrg(e.target.value); setRepos([]); setRepoName(""); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), loadRepos())}
              placeholder="job-escape"
              style={{ width: "100%", marginTop: "0.375rem", fontFamily: "'DM Mono', monospace", fontSize: "13px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="button"
            onClick={loadRepos}
            disabled={!org.trim() || reposLoading}
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", padding: "0.625rem 1rem", background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", color: reposLoading ? "var(--text-muted)" : "var(--text)", cursor: org.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", marginBottom: "0" }}
          >
            {reposLoading ? "loading..." : "Load repos →"}
          </button>
        </div>

        {reposError && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#f87171", margin: 0 }}>{reposError}</p>
        )}

        <div>
          <label style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Repository Name
          </label>
          {repos.length > 0 ? (
            <select
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              style={{ width: "100%", marginTop: "0.375rem", fontFamily: "'DM Mono', monospace", fontSize: "13px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: repoName ? "var(--text)" : "var(--text-muted)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box" }}
            >
              <option value="">— select a repo —</option>
              {repos.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="jobescape-app"
              style={{ width: "100%", marginTop: "0.375rem", fontFamily: "'DM Mono', monospace", fontSize: "13px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box" }}
            />
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div>
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem" }}>
          {(["guided", "upload"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: "11px", padding: "6px 16px",
                background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                color: tab === t ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "-1px",
              }}
            >
              {t === "guided" ? "Guided" : "Upload README / CLAUDE.md"}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "8px", padding: "2rem", textAlign: "center", cursor: "pointer",
                color: "var(--text-muted)", fontFamily: "'DM Mono', monospace", fontSize: "12px",
                background: dragOver ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent",
                marginBottom: "0.75rem",
              }}
            >
              drag & drop README.md or CLAUDE.md here, or click to browse
              <input ref={fileInputRef} type="file" accept=".md,.txt" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              or paste content:
            </p>
            <textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              rows={6}
              placeholder="Paste your README.md or CLAUDE.md content here..."
              style={{
                width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "11px",
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
                color: "var(--text)", padding: "0.75rem", resize: "vertical", boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => uploadText && applyParsed(uploadText)}
              style={{
                marginTop: "0.5rem", fontFamily: "'DM Mono', monospace", fontSize: "12px",
                padding: "5px 12px", background: "var(--accent)", color: "#000", border: "none",
                borderRadius: "6px", cursor: "pointer",
              }}
            >
              Auto-detect stack →
            </button>
          </div>
        )}
      </div>

      {/* Auto-detect hint */}
      {detectHint === "failed" && (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent-amber)", margin: 0, padding: "8px 12px", border: "1px solid var(--accent-amber)", borderRadius: "6px", opacity: 0.85 }}>
          Stack not detected — this file may not describe the tech stack. Try uploading <strong>README.md</strong> instead, or select the stack manually below.
        </p>
      )}
      {detectHint === "ok" && (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--accent)", margin: 0 }}>
          ✓ stack detected — review and adjust below if needed
        </p>
      )}

      {/* Repo type selector (client-controlled) */}
      <div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
          Repo Type
        </span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["frontend", "backend", "mobile", "data"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => { setRepoType(type); setSelectedL1([]); setSelectedL2([]); }}
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: "12px", padding: "5px 12px",
                borderRadius: "20px", border: "1px solid",
                borderColor: repoType === type ? "var(--accent)" : "var(--border)",
                background: repoType === type ? "var(--accent)" : "transparent",
                color: repoType === type ? "#000" : "var(--text-muted)",
                cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Level 1: Framework */}
      <div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
          Framework / Runtime
        </span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {options.level1.map((chip) => (
            <Chip key={chip} label={chip} selected={selectedL1.includes(chip)} onToggle={() => toggleL1(chip)} />
          ))}
        </div>
      </div>

      {/* Level 2: Additional technologies */}
      {availableL2.length > 0 && (
        <div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
            Additional Technologies
          </span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {availableL2.map((chip) => (
              <Chip key={chip} label={chip} selected={selectedL2.includes(chip)} onToggle={() => toggleL2(chip)} />
            ))}
          </div>
        </div>
      )}

      {/* Custom chips */}
      <div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
          Custom Tags
        </span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {customChips.map((chip) => (
            <Chip
              key={chip}
              label={chip}
              selected
              onToggle={() => setCustomChips((prev) => prev.filter((c) => c !== chip))}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
            placeholder="e.g. GraphQL, Prisma..."
            style={{
              fontFamily: "'DM Mono', monospace", fontSize: "12px",
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: "6px",
              color: "var(--text)", padding: "5px 10px", outline: "none", flex: 1,
            }}
          />
          <button
            type="button"
            onClick={addCustom}
            style={{
              fontFamily: "'DM Mono', monospace", fontSize: "12px", padding: "5px 12px",
              background: "transparent", border: "1px solid var(--border)", borderRadius: "6px",
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            + add
          </button>
        </div>
      </div>

      {/* CLAUDE.md hint for stack-specific technologies */}
      <ClaudeMdHint stackTags={[...selectedL1, ...selectedL2, ...customChips]} />

      {/* Prompt preview — only when L1 is selected */}
      {selectedL1.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            style={{
              fontFamily: "'DM Mono', monospace", fontSize: "11px", padding: "5px 12px",
              background: "transparent", border: "1px solid var(--border)", borderRadius: "6px",
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            {showPrompt ? "▲ hide system prompt" : "▼ preview system prompt"}
          </button>

          {showPrompt && (
            <div style={{ marginTop: "0.75rem" }}>
              <textarea
                readOnly
                value={promptLoading ? "Loading..." : promptPreview}
                rows={18}
                style={{
                  width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "11px",
                  background: "color-mix(in srgb, var(--card) 60%, transparent)",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  color: "var(--text-muted)", padding: "0.75rem", resize: "vertical",
                  boxSizing: "border-box", lineHeight: 1.6,
                }}
              />
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--text-dim)", marginTop: "0.375rem" }}>
                Read-only. Use "Custom Prompt Additions" below to append extra rules.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Base branch */}
      <div>
        <label style={fieldLabelStyle}>Base Branch</label>
        <input
          name="base_branch"
          type="text"
          defaultValue="main"
          style={inputStyle}
        />
      </div>

      {/* Custom prompt */}
      <div>
        <label style={fieldLabelStyle}>Custom Prompt Additions (optional)</label>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
          Extra rules appended to the system prompt. E.g. "Always check src/api/ for backend errors."
        </p>
        <textarea
          name="custom_prompt"
          rows={4}
          placeholder="Add project-specific instructions here..."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Active checkbox */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
        <input type="checkbox" name="set_active" defaultChecked />
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "var(--text)" }}>
          Set as active repo (bot will use this repo for all reactions)
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={selectedL1.length === 0}
        style={{
          fontFamily: "'DM Mono', monospace", fontSize: "13px", fontWeight: 600,
          background: selectedL1.length === 0 ? "transparent" : "var(--accent)",
          color: selectedL1.length === 0 ? "var(--text-dim)" : "#000",
          border: selectedL1.length === 0 ? "1px solid var(--border)" : "none",
          borderRadius: "8px", padding: "0.75rem 1.5rem",
          cursor: selectedL1.length === 0 ? "not-allowed" : "pointer",
          alignSelf: "flex-start", transition: "background 0.15s, color 0.15s, border-color 0.15s",
        }}
      >
        {selectedL1.length === 0 ? "← select a framework above" : "Add repository →"}
      </button>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.08em",
  color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.375rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%", fontFamily: "'DM Mono', monospace", fontSize: "13px",
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px",
  color: "var(--text)", padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box",
};

const CLAUDE_MD_HINTS: Record<string, string> = {
  "Effector": "document your stores ($storeName), events, and effects in CLAUDE.md so the bot finds them fast",
  "farfetched": "list your query() handlers and which API endpoints they call in CLAUDE.md",
  "Zustand": "note your store slices and where they live (e.g. src/store/) in CLAUDE.md",
  "Redux": "document your slice files and RTK Query endpoints in CLAUDE.md",
  "Riverpod": "list your provider files and naming conventions in CLAUDE.md",
  "TCA": "document your feature reducers and their file locations in CLAUDE.md",
  "Bloc": "list your Bloc/Cubit classes and which features they manage in CLAUDE.md",
  "MobX": "document your observable stores and their locations in CLAUDE.md",
  "GraphQL": "note your schema file path and code-gen output location in CLAUDE.md",
  "Prisma": "document your schema.prisma location and key model relationships in CLAUDE.md",
  "SQLAlchemy": "list your models directory and session setup in CLAUDE.md",
  "Room": "document your DAO interfaces and database class location in CLAUDE.md",
  "CoreData": "note your .xcdatamodeld file and NSManagedObject subclass locations in CLAUDE.md",
};

function ClaudeMdHint({ stackTags }: { stackTags: string[] }) {
  const matched = stackTags.filter((t) => CLAUDE_MD_HINTS[t]);
  if (matched.length === 0) return null;

  return (
    <div style={{
      border: "1px solid color-mix(in srgb, var(--accent-amber) 40%, transparent)",
      borderRadius: "8px",
      padding: "0.75rem 1rem",
      background: "color-mix(in srgb, var(--accent-amber) 6%, transparent)",
    }}>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "var(--accent-amber)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 0.5rem 0" }}>
        tip · improve bot accuracy
      </p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", margin: "0 0 0.5rem 0", lineHeight: 1.5 }}>
        The bot reads your repo's <code style={{ color: "var(--text)", background: "color-mix(in srgb, var(--border) 60%, transparent)", padding: "1px 4px", borderRadius: "3px" }}>CLAUDE.md</code> on every fix. For best results with your stack:
      </p>
      <ul style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "var(--text-muted)", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
        {matched.map((tag) => (
          <li key={tag}><span style={{ color: "var(--text)" }}>{tag}:</span> {CLAUDE_MD_HINTS[tag]}</li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        fontFamily: "'DM Mono', monospace", fontSize: "11px", padding: "4px 10px",
        borderRadius: "20px", border: "1px solid",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
        color: selected ? "var(--accent)" : "var(--text-muted)",
        cursor: "pointer",
      }}
    >
      {selected ? "✓ " : ""}{label}
    </button>
  );
}
