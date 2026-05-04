import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const prNumber = Number(process.env.PR_NUMBER);
const prTitle = process.env.PR_TITLE ?? "Unknown";
const prBody = process.env.PR_BODY ?? "";
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

// Fetch changed files via GitHub API
const { data: files } = await octokit.pulls.listFiles({
  owner,
  repo,
  pull_number: prNumber,
  per_page: 100,
});

const changedFilesList = files
  .map((f) => `${f.status}: ${f.filename} (+${f.additions}/-${f.deletions})`)
  .join("\n");

// Fetch diff patches (truncated to 60KB total)
let diffContent = "";
let totalSize = 0;
for (const f of files) {
  if (f.patch && totalSize < 61440) {
    const chunk = `--- ${f.filename}\n${f.patch}\n\n`;
    diffContent += chunk;
    totalSize += chunk.length;
  }
}

const MANIFEST_FORMAT = `---
pr: {PR_NUMBER}
date: {DATE}
title: {TITLE}
features: {COMMA_SEPARATED_FEATURE_KEYWORDS}
---

## Summary
{1-3 sentence description of what was done and why}

## Changed files
- \`path/to/file.tsx\` — what changed and why

## Created files
- \`path/to/new.tsx\` — what it does (omit section if none)

## Key implementation details
- {Specific pattern, prop name, state management, API used}
- {Breaking changes, migration notes, non-obvious decisions}

## Likely affected screens
- {Screen or component name} — {why it could be affected}`;

const prompt = `You are generating a feature memory manifest for a codebase. This manifest will be used by an AI bug-fixer to understand what changed in a PR, which files are involved, and what could cause bugs.

PR #${prNumber}: ${prTitle}

PR description:
${prBody || "(no description provided)"}

Changed files (from GitHub API):
${changedFilesList}

Code diff:
\`\`\`diff
${diffContent || "(no diff available)"}
\`\`\`

Generate a feature memory manifest using EXACTLY this format:
${MANIFEST_FORMAT}

Rules:
- Replace {DATE} with: ${new Date().toISOString().slice(0, 10)}
- Replace {PR_NUMBER} with: ${prNumber}
- features: field — comma-separated searchable keywords: screen names, section names, component names, library names (e.g. "Registration, StepForm, Validation, React Hook Form")
- ## Changed files — use backtick paths with description. List ALL changed files from the list above.
- ## Created files — only if new files (status: added). Omit section entirely if none.
- ## Key implementation details — be specific: component props, hooks used, state patterns, breaking changes, non-obvious decisions. This is the most important section.
- ## Likely affected screens — which other parts could break
- Be specific and technical. This is read by an AI agent that needs to find and fix bugs.
- Output ONLY the markdown, starting with ---, no other text.`;

const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1500,
  messages: [{ role: "user", content: prompt }],
});

const manifest = response.content[0].type === "text" ? response.content[0].text.trim() : "";

if (!manifest || !manifest.startsWith("---")) {
  console.error("Invalid manifest generated:", manifest);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const slug = prTitle
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 40);
const filename = `${date}-pr-${prNumber}-${slug}.md`;

const memoryDir = join(process.cwd(), ".feature-memory");
if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });

writeFileSync(join(memoryDir, filename), manifest, "utf8");

console.log(`✅ Generated: .feature-memory/${filename}`);
console.log(manifest);
