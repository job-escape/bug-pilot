import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, dirname, resolve } from "path";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import { loadManifests, formatManifests } from "../memory/loader.js";
import { downloadImage } from "../slack/client.js";
import { SYSTEM_PROMPT, buildInitialPrompt } from "./prompts.js";
import { buildSystemPrompt } from "./stack-templates.js";
import type { Bug, FixResult, ChangedFile } from "../types.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.FIX_MODEL ?? "claude-sonnet-4-6";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const MAX_FILE_SIZE = 100 * 1024; // 100KB cap per file
const MAX_TOOL_ROUNDS = 12;

interface ClaudeChangedFile {
  filePath: string;
  lineRange?: string | null;
  action: "modified" | "created";
  patch: string;
}

interface ClaudeResponse {
  status?: string;
  filePath?: string | null;
  lineRange?: string | null;
  rationale?: string;
  changedFiles?: ClaudeChangedFile[];
}

// Tool definitions Claude will use to explore and fix the repo
const REPO_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the content of a file in the repository. Use relative paths from the repo root.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path from repo root, e.g. 'src/components/Button.tsx'" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_file",
    description: "Search for a keyword or function name in a file and return matching lines with context. Use this before read_file on large files to find the relevant section.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path from repo root" },
        query: { type: "string", description: "Text to search for (case-insensitive)" },
        context_lines: { type: "number", description: "Lines of context around each match (default 10)" },
      },
      required: ["path", "query"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories at a path in the repository. Use '.' for the root.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative path from repo root, e.g. 'src/components' or '.'" },
      },
      required: ["path"],
    },
  },
  {
    name: "submit_fix",
    description: "Submit the final fix result. Call this when you have found and fixed the bug, or determined it cannot be fixed.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["fixed", "needs-clarification", "not-found"] },
        filePath: { type: "string", nullable: true, description: "Primary file changed" },
        lineRange: { type: "string", nullable: true, description: "Line range like '42-48'" },
        rationale: { type: "string", description: "One sentence: what was wrong and what you changed" },
        changedFiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filePath: { type: "string" },
              lineRange: { type: "string", nullable: true },
              action: { type: "string", enum: ["modified", "created"] },
              patch: { type: "string", description: "Complete new file content" },
            },
            required: ["filePath", "action", "patch"],
          },
        },
      },
      required: ["status", "rationale", "changedFiles"],
    },
  },
];

function safeReadFile(repoDir: string, relPath: string): string {
  // Prevent path traversal
  const full = resolve(join(repoDir, relPath));
  if (!full.startsWith(resolve(repoDir))) {
    return "Error: path traversal not allowed";
  }
  if (!existsSync(full)) return `Error: file not found: ${relPath}`;
  try {
    const stat = statSync(full);
    if (stat.isDirectory()) return `Error: ${relPath} is a directory, use list_directory instead`;
    if (stat.size > MAX_FILE_SIZE) return `Error: file too large (${stat.size} bytes), max ${MAX_FILE_SIZE}`;
    return readFileSync(full, "utf8");
  } catch (e) {
    return `Error reading file: ${String(e)}`;
  }
}

function safeSearchFile(repoDir: string, relPath: string, query: string, contextLines = 10): string {
  const full = resolve(join(repoDir, relPath));
  if (!full.startsWith(resolve(repoDir))) return "Error: path traversal not allowed";
  if (!existsSync(full)) return `Error: file not found: ${relPath}`;
  try {
    const lines = readFileSync(full, "utf8").split("\n");
    const lowerQuery = query.toLowerCase();
    const matchedRanges: [number, number][] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.toLowerCase().includes(lowerQuery)) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        matchedRanges.push([start, end]);
      }
    }

    if (matchedRanges.length === 0) return `No matches for "${query}" in ${relPath}`;

    // Merge overlapping ranges
    const merged: [number, number][] = [];
    for (const range of matchedRanges) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], range[1]);
      } else {
        merged.push([...range]);
      }
    }

    const sections = merged.map(([start, end]) => {
      const excerpt = lines.slice(start, end + 1).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
      return `[lines ${start + 1}–${end + 1}]\n${excerpt}`;
    });

    return `Found ${matchedRanges.length} match(es) in ${relPath}:\n\n${sections.join("\n\n...")}`;
  } catch (e) {
    return `Error searching file: ${String(e)}`;
  }
}

function safeListDir(repoDir: string, relPath: string): string {
  const full = resolve(join(repoDir, relPath));
  if (!full.startsWith(resolve(repoDir))) return "Error: path traversal not allowed";
  if (!existsSync(full)) return `Error: directory not found: ${relPath}`;
  try {
    const entries = readdirSync(full, { withFileTypes: true });
    const lines = entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== ".next")
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return lines.join("\n") || "(empty)";
  } catch (e) {
    return `Error listing directory: ${String(e)}`;
  }
}

function loadCodebaseGuide(repoDir: string): string {
  const path = join(repoDir, "CLAUDE.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return "";
}

function loadLastPRs(repoDir: string): string {
  const path = join(repoDir, "LAST_PRS.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return "";
}

function loadManifestFiles(repoDir: string, manifests: { body: string }[]): string {
  const filePattern = /[-*]\s+`?([^\s`]+\.(tsx?|jsx?|css|json))`?/gm;
  const paths = new Set<string>();

  for (const m of manifests) {
    let match;
    while ((match = filePattern.exec(m.body)) !== null) {
      if (match[1]) paths.add(match[1]);
    }
  }

  const sections: string[] = [];
  for (const relPath of paths) {
    const content = safeReadFile(repoDir, relPath);
    if (!content.startsWith("Error:")) {
      sections.push(`### ${relPath}\n\`\`\`\n${content}\n\`\`\``);
    }
  }
  return sections.join("\n\n");
}

function applyFix(repoDir: string, parsed: ClaudeResponse): ChangedFile[] {
  const changedFiles: ChangedFile[] = [];
  if (!parsed.changedFiles) return changedFiles;

  for (const file of parsed.changedFiles) {
    if (!file.filePath || !file.patch) continue;

    const fullPath = join(repoDir, file.filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, file.patch, "utf8");

    changedFiles.push({
      filePath: file.filePath,
      lineRange: file.lineRange ?? null,
      action: file.action ?? "modified",
    });
  }
  return changedFiles;
}

async function extractVideoFrames(
  videoUrl: string,
  token: string
): Promise<{ base64: string; mediaType: string; isVideo: true }[]> {
  const tmpVideo = join(tmpdir(), `bug-pilot-video-${Date.now()}.mov`);
  const tmpFrameDir = join(tmpdir(), `bug-pilot-frames-${Date.now()}`);
  mkdirSync(tmpFrameDir, { recursive: true });

  try {
    // Download video
    const res = await fetch(videoUrl, { headers: { Authorization: `Bearer ${token}` } });
    const buf = await res.arrayBuffer();
    writeFileSync(tmpVideo, Buffer.from(buf));

    // Get duration via ffprobe
    const probe = spawnSync("ffprobe", [
      "-v", "quiet", "-show_entries", "format=duration",
      "-of", "csv=p=0", tmpVideo,
    ], { encoding: "utf8" });
    const duration = parseFloat(probe.stdout?.trim() ?? "10") || 10;

    // Pick frame count based on duration
    const frameCount = duration < 10 ? 4 : duration < 30 ? 6 : 8;
    const interval = duration / (frameCount + 1);

    // Build select expression: pts at each interval
    const selectExpr = Array.from({ length: frameCount }, (_, i) =>
      `eq(n,${Math.round((i + 1) * interval * 30)})`
    ).join("+");

    // Extract frames
    spawnSync("ffmpeg", [
      "-i", tmpVideo,
      "-vf", `select='${selectExpr}',scale=1280:-1`,
      "-vsync", "vfr",
      "-q:v", "3",
      join(tmpFrameDir, "frame_%d.jpg"),
    ], { encoding: "utf8" });

    // Read frames
    const frames: { base64: string; mediaType: string; isVideo: true }[] = [];
    for (let i = 1; i <= frameCount; i++) {
      const framePath = join(tmpFrameDir, `frame_${i}.jpg`);
      if (existsSync(framePath)) {
        frames.push({
          base64: readFileSync(framePath).toString("base64"),
          mediaType: "image/jpeg",
          isVideo: true,
        });
      }
    }

    console.log(`[video] extracted ${frames.length}/${frameCount} frames (duration=${duration.toFixed(1)}s)`);
    return frames;
  } catch (err) {
    console.error(`[video] frame extraction failed: ${err}`);
    return [];
  } finally {
    try { unlinkSync(tmpVideo); } catch {}
    try {
      for (let i = 1; i <= 8; i++) {
        const f = join(tmpFrameDir, `frame_${i}.jpg`);
        if (existsSync(f)) unlinkSync(f);
      }
      spawnSync("rmdir", [tmpFrameDir]);
    } catch {}
  }
}

export async function fixBug(bug: Bug, repoDir: string, featureArea: string, repoConfig?: import("../types.js").RepoConfig, bugIndex = 0, model = MODEL, threadContext?: string): Promise<FixResult> {
  const tag = `[bug#${bugIndex + 1}]`;

  const manifests = loadManifests(repoDir, featureArea);
  const manifestContext = formatManifests(manifests);
  console.log(`${tag}[memory] feature="${featureArea}" manifests=${manifests.length}${manifests.length > 0 ? ": " + manifests.map((m) => m.filePath).join(", ") : " (none)"}`);

  const manifestFileContents = loadManifestFiles(repoDir, manifests);
  if (manifests.length > 0) {
    const fileCount = (manifestFileContents.match(/^### /gm) ?? []).length;
    console.log(`${tag}[memory] pre-loaded ${fileCount} file(s) from manifests`);
  }

  const codeguide = loadCodebaseGuide(repoDir);
  const lastPRs = loadLastPRs(repoDir);
  if (lastPRs) console.log(`${tag}[context] LAST_PRS.md loaded (${lastPRs.length} chars)`);
  else console.log(`${tag}[context] LAST_PRS.md not found in ${repoDir}`);

  // Collect all images — extract frames if video, otherwise download directly
  const allImages: { base64: string; mediaType: string; isVideo?: boolean }[] = [];
  for (const img of bug.images) {
    try {
      if (img.isVideo) {
        const frames = await extractVideoFrames(img.url, SLACK_BOT_TOKEN);
        allImages.push(...frames);
        console.log(`${tag}[media] video → ${frames.length} frames`);
      } else {
        const downloaded = await downloadImage(img.url, SLACK_BOT_TOKEN);
        allImages.push({ base64: downloaded.base64, mediaType: downloaded.mediaType });
        console.log(`${tag}[media] image downloaded (${downloaded.mediaType})`);
      }
    } catch {
      // proceed without this image
    }
  }

  console.log(`${tag} text="${bug.text.slice(0, 80).replace(/\n/g, " ")}"`);

  const initialContent = buildInitialPrompt(bug.text, manifestContext, manifestFileContents, codeguide, lastPRs, bug.previousAttempts, allImages.length > 0 ? allImages : undefined, threadContext, bug.userNote);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: initialContent as Anthropic.MessageParam["content"] },
  ];

  let finalResult: ClaudeResponse | null = null;
  let lastTextContent = "";
  let nudgeCount = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`${tag}[agent] round=${round}`);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      system: repoConfig ? buildSystemPrompt(repoConfig) : SYSTEM_PROMPT,
      tools: REPO_TOOLS,
      messages,
    });

    console.log(`${tag}[agent] stop_reason=${response.stop_reason}`);

    // Capture any text Claude writes (for rationale fallback)
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        lastTextContent = block.text;
      }
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      // Claude responded with text but didn't call submit_fix — nudge it (max 3 times)
      if (!finalResult && nudgeCount < 3) {
        nudgeCount++;
        console.log(`${tag}[agent] nudging to call submit_fix (${nudgeCount}/3)`);
        messages.push({
          role: "user",
          content: `You MUST call submit_fix now — do not write text. Call submit_fix with:\n- status: "needs-clarification" if you cannot fix it\n- status: "fixed" with changedFiles if you have a fix\n- status: "not-found" if this is a backend bug\n\nNo more text responses allowed.`,
        });
        continue;
      }
      break;
    }

    if (response.stop_reason === "max_tokens") {
      console.log(`${tag}[agent] max_tokens hit — asking Claude to continue`);
      messages.push({ role: "user", content: "Continue from where you left off." });
      continue;
    }

    if (response.stop_reason !== "tool_use") break;

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let gotSubmit = false;

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as Record<string, string>;

      if (block.name === "read_file") {
        const result = safeReadFile(repoDir, input.path ?? "");
        console.log(`${tag}[agent] read_file: ${input.path} (${result.length} chars)`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } else if (block.name === "search_file") {
        const contextLines = input.context_lines ? parseInt(input.context_lines) : 10;
        const result = safeSearchFile(repoDir, input.path ?? "", input.query ?? "", contextLines);
        console.log(`${tag}[agent] search_file: ${input.path} query="${input.query}"`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } else if (block.name === "list_directory") {
        const result = safeListDir(repoDir, input.path ?? ".");
        console.log(`${tag}[agent] list_directory: ${input.path}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } else if (block.name === "submit_fix") {
        finalResult = block.input as unknown as ClaudeResponse;
        console.log(`${tag}[agent] submit_fix: status=${finalResult.status} files=${finalResult.changedFiles?.length ?? 0}`);
        if (finalResult.rationale) {
          console.log(`${tag}[agent] rationale: ${finalResult.rationale.slice(0, 120)}`);
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Fix submitted." });
        gotSubmit = true;
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (gotSubmit) break;
  }

  if (!finalResult) {
    // Extract rationale from Claude's last text response
    const rationale = lastTextContent
      ? lastTextContent.slice(0, 500).replace(/\n+/g, " ").trim()
      : "Agent did not submit a fix within the allowed rounds.";
    return {
      status: "needs-clarification",
      filePath: null,
      lineRange: null,
      changedFiles: [],
      rationale,
    };
  }

  const status = (finalResult.status ?? "not-found") as FixResult["status"];
  const changedFiles = status === "fixed" ? applyFix(repoDir, finalResult) : [];
  const primaryFile = finalResult.filePath ?? changedFiles[0]?.filePath ?? null;
  const primaryRange = finalResult.lineRange ?? changedFiles[0]?.lineRange ?? null;

  return {
    status,
    filePath: primaryFile,
    lineRange: primaryRange,
    changedFiles,
    rationale: finalResult.rationale ?? "No rationale provided.",
  };
}

export async function fixAllBugs(
  bugs: Bug[],
  repoDir: string,
  featureArea: string,
  repoConfig?: import("../types.js").RepoConfig
): Promise<FixResult[]> {
  const results: FixResult[] = [];
  for (let i = 0; i < bugs.length; i++) {
    const result = await fixBug(bugs[i]!, repoDir, featureArea, repoConfig, i);
    results.push(result);
  }
  return results;
}
