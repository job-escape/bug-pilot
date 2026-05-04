import express from "express";
import { App, ExpressReceiver, LogLevel } from "@slack/bolt";
import { fetchThread } from "./slack/client.js";
import { parseThreadMetadata } from "./slack/parser.js";
import { cloneRepo, makeTempDir, cleanupDir, checkoutBranch, stageAndCommit, pushBranch, openDraftPR } from "./github/client.js";
import type { RepoContext } from "./github/client.js";
import { fixBug } from "./agent/runner.js";
import { sql } from "./db/client.js";
import { getConfig } from "./config.js";
import type { Bug, FixResult, RepoConfig } from "./types.js";
import type { SlackMessage } from "./slack/client.js";

const {
  PORT = "3001",
  TARGET_REPO,
  GITHUB_OWNER,
  BASE_BRANCH = "main",
} = process.env;

const cfg = await getConfig();

const SLACK_BOT_TOKEN = cfg.slack_bot_token || process.env.SLACK_BOT_TOKEN || "";
const SLACK_SIGNING_SECRET = cfg.slack_signing_secret || process.env.SLACK_SIGNING_SECRET || "";
const TRIGGER_EMOJI = cfg.trigger_emoji || process.env.TRIGGER_EMOJI || "robot_face";
const DASHBOARD_URL = cfg.dashboard_url || process.env.DASHBOARD_URL || "http://localhost:3003";
const ALLOWED_USER_ID = cfg.allowed_user_id || process.env.MUKAN_SLACK_USER_ID || "";
const ALLOWED_CHANNELS_RAW = cfg.allowed_channels || process.env.ALLOWED_CHANNELS || "";

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
  throw new Error("Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET");
}

const allowedChannels = new Set(ALLOWED_CHANNELS_RAW.split(",").map((s: string) => s.trim()).filter(Boolean));

async function resolveActiveRepo(): Promise<RepoConfig | null> {
  try {
    const rows = await sql<RepoConfig[]>`
      SELECT name, github_owner, base_branch, repo_type, stack_tags, custom_prompt
      FROM repos WHERE is_active = true LIMIT 1
    `;
    if (rows.length > 0) return rows[0]!;
  } catch {}

  if (TARGET_REPO && GITHUB_OWNER) {
    return { name: TARGET_REPO, github_owner: GITHUB_OWNER, base_branch: BASE_BRANCH, repo_type: "frontend", stack_tags: [], custom_prompt: null };
  }

  return null;
}

async function sendDM(client: App["client"], userId: string, text: string): Promise<void> {
  try {
    const dm = await client.conversations.open({ users: userId });
    const dmChannel = dm.channel?.id;
    if (!dmChannel) { console.error(`[DM] could not open DM with ${userId}`); return; }
    await client.chat.postMessage({ channel: dmChannel, text });
    console.log(`[DM] sent to ${userId}`);
  } catch (err) {
    console.error(`[DM] failed: ${err}`);
  }
}

const NOISE_PATTERNS = [
  /^пока (комментов|ком)/i,
  /^нет (комментов|ком)/i,
  /^ок[,.]?$/i,
  /^\+\d*$/,
  /^[👍🙏✅❤️]+$/u,
];

const NOT_FIXABLE_PATTERNS = [
  /не получится поменять/i,
  /нельзя (поменять|исправить|изменить)/i,
  /встроен(ная|ный|о) в компонент/i,
  /это (не|невозможно) исправить/i,
  /cannot (be )?fix/i,
  /built[-\s]?in component/i,
];

type BugClassification = "actionable" | "noise" | "not-fixable";

function classifyBug(msg: SlackMessage): BugClassification {
  const text = msg.text?.trim() ?? "";
  if (msg.images.length === 0 && text.length < 5) return "noise";
  if (NOISE_PATTERNS.some((p) => p.test(text))) return "noise";
  if (NOT_FIXABLE_PATTERNS.some((p) => p.test(text))) return "not-fixable";
  return "actionable";
}

const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
});

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
  logLevel: LogLevel.INFO,
});

// ── PARSE: triggered by reaction, parse only, no fixing ──────────────────────
app.event("reaction_added", async ({ event, client, logger }) => {
  if (event.reaction !== TRIGGER_EMOJI) return;
  if (event.item.type !== "message") return;
  if (allowedChannels.size > 0 && !allowedChannels.has(event.item.channel)) return;

  const { channel, ts } = event.item;
  const triggerUserId = event.user;
  logger.info(`triggered: channel=${channel} ts=${ts}`);

  void (async () => {
    try {
      const repoConfig = await resolveActiveRepo();
      if (!repoConfig) {
        await sendDM(client, triggerUserId, "⚠️ No active repo configured. Visit the dashboard to set one up.");
        return;
      }

      const messages = await fetchThread(client, channel, ts);
      const [top, ...replies] = messages;
      if (!top) return;

      const metadata = await parseThreadMetadata(
        top.text,
        replies.map((r) => r.text),
        cfg.parser_model || process.env.PARSER_MODEL
      );
      logger.info(`parsed: ${JSON.stringify(metadata)} repo=${repoConfig.name}`);

      const [thread] = await sql<{ id: number; last_processed_ts: string }[]>`
        INSERT INTO threads (slack_ts, slack_permalink, platform, build, environment, feature, status, repo)
        VALUES (${ts}, ${top.permalink}, ${metadata.platform}, ${metadata.build}, ${metadata.environment}, ${metadata.feature}, 'pending', ${repoConfig.name})
        ON CONFLICT (slack_ts) DO UPDATE SET status = 'pending'
        RETURNING id, last_processed_ts
      `;

      const lastProcessedTs = thread!.last_processed_ts;

      const candidateMessages = replies.filter((m) => {
        if (m.botId) return false;
        if (m.ts <= lastProcessedTs) return false;
        return classifyBug(m) !== "noise";
      });

      if (candidateMessages.length === 0) {
        await sendDM(client, triggerUserId, `🤷 No actionable bugs found in the thread.`);
        return;
      }

      // Insert bugs — actionable as pending, not-fixable as skipped
      for (const m of candidateMessages) {
        const classification = classifyBug(m);
        // Auto-skip if no text description (image-only messages can't be fixed without context)
        const noText = !m.text.trim();
        const status = classification === "not-fixable" || noText ? "skipped" : "pending";
        const rationale = classification === "not-fixable"
          ? "Skipped: author indicated this cannot be fixed (built-in component or explicit limitation)"
          : noText
            ? "Skipped: no text description provided (image-only message)"
            : null;
        const imageUrls = m.images.map((i) => i.url);
        await sql`
          INSERT INTO bugs (thread_id, text, image_url, image_urls, status, slack_permalink, rationale)
          VALUES (${thread!.id}, ${m.text}, ${m.images[0]?.url ?? null}, ${sql.array(imageUrls)}, ${status}, ${m.permalink}, ${rationale})
          ON CONFLICT DO NOTHING
        `;
      }

      // Update last_processed_ts
      const newestTs = candidateMessages.reduce((max: string, m) => m.ts > max ? m.ts : max, "0");
      await sql`UPDATE threads SET last_processed_ts = ${newestTs} WHERE id = ${thread!.id}`;

      const pendingCount = candidateMessages.filter((m) => classifyBug(m) === "actionable").length;
      const dashLink = `${DASHBOARD_URL}/repos/${encodeURIComponent(repoConfig.name)}/threads/${thread!.id}`;
      await sendDM(
        client,
        triggerUserId,
        `🔍 Found *${pendingCount}* bug${pendingCount !== 1 ? "s" : ""} in *${metadata.feature}*\nReview and execute: ${dashLink}`
      );
    } catch (err) {
      logger.error(`parse flow failed: ${err}`);
    }
  })();
});

// ── EXECUTE: called from dashboard POST /execute ──────────────────────────────
receiver.router.post("/execute", express.json(), async (req: any, res: any) => {
  const { threadId, userId } = req.body as { threadId: number; userId?: string };
  if (!threadId) return res.status(400).json({ error: "threadId required" });

  res.status(202).json({ ok: true });

  void (async () => {
    let workDir: string | null = null;
    try {
      const [thread] = await sql<{ id: number; slack_ts: string; slack_permalink: string; feature: string; platform: string; build: string | null; repo: string; user_context: string | null }[]>`
        SELECT id, slack_ts, slack_permalink, feature, platform, build, repo, user_context FROM threads WHERE id = ${threadId}
      `;
      if (!thread) return;

      const repoConfig = await resolveActiveRepo();
      if (!repoConfig) return;

      const pendingBugs = await sql<{ id: number; text: string; image_url: string | null; image_urls: string[] | null; slack_permalink: string | null; user_note: string | null }[]>`
        SELECT id, text, image_url, image_urls, slack_permalink, user_note FROM bugs WHERE thread_id = ${threadId} AND status = 'pending'
      `;

      if (pendingBugs.length === 0) return;

      await sql`UPDATE threads SET status = 'in-progress' WHERE id = ${threadId}`;

      const repoCtx: RepoContext = {
        owner: repoConfig.github_owner,
        repo: repoConfig.name,
        baseBranch: repoConfig.base_branch,
        token: process.env.GITHUB_TOKEN || "",
      };

      workDir = makeTempDir();
      await cloneRepo(workDir, repoCtx);

      const featureSlug = thread.feature.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
      const dateSlug = new Date().toISOString().slice(0, 10);
      const branchName = `fix/qa-${featureSlug}-${dateSlug}`;
      await checkoutBranch(workDir, branchName);

      const bugResults: { bugId: number; bug: Bug; result: FixResult }[] = [];

      for (let i = 0; i < pendingBugs.length; i++) {
        const pb = pendingBugs[i]!;

        // Build thread context: previous bugs in this batch so bot understands "тоже так" references
        const previousBugsContext = i > 0
          ? `## Other bugs in this QA thread (for context)\n\n` +
            pendingBugs.slice(0, i).map((b, j) => `Bug #${j + 1}: ${b.text}`).join("\n")
          : undefined;

        const imageUrls = pb.image_urls?.length ? pb.image_urls : pb.image_url ? [pb.image_url] : [];
        const bug: Bug = {
          text: pb.text,
          images: imageUrls.map((url) => ({ url, mimetype: url.includes(".mp4") || url.includes("video") ? "video/mp4" : "image/jpeg" })),
          slackPermalink: pb.slack_permalink ?? "",
          userNote: pb.user_note ?? undefined,
        };

        const combinedContext = [thread.user_context, previousBugsContext].filter(Boolean).join("\n\n") || undefined;

        const result = await fixBug(
          bug,
          workDir,
          thread.feature,
          repoConfig,
          i,
          cfg.fix_model || process.env.FIX_MODEL,
          combinedContext
        );
        bugResults.push({ bugId: pb.id, bug, result });

        await sql`UPDATE bugs SET status = ${result.status}, file_path = ${result.filePath}, line_range = ${result.lineRange}, rationale = ${result.rationale} WHERE id = ${pb.id}`;

        if (result.status === "fixed") {
          const shortText = bug.text.slice(0, 60).replace(/\n/g, " ");
          await stageAndCommit(workDir, `fix(qa): ${shortText}\n\nSlack: ${bug.slackPermalink}`);
        }
      }

      const fixed = bugResults.filter(({ result }) => result.status === "fixed");
      const needsClarification = bugResults.filter(({ result }) => result.status === "needs-clarification");

      const dmTarget = userId || ALLOWED_USER_ID;
      const dashLink = `${DASHBOARD_URL}/repos/${encodeURIComponent(repoConfig.name)}/threads/${threadId}`;

      if (fixed.length === 0) {
        await sql`UPDATE threads SET status = 'no-fixes' WHERE id = ${threadId}`;
        if (dmTarget) {
          await sendDM(
            app.client,
            dmTarget,
            `⚠️ Could not fix any bugs. ${needsClarification.length > 0 ? `${needsClarification.length} need clarification.` : ""}\n${dashLink}`
          );
        }
        return;
      }

      await pushBranch(workDir, branchName, repoCtx);

      const prTitle = `fix(qa): batch fix from QA thread ${new Date().toISOString().slice(0, 10)}`;

      const checklist = bugResults
        .map(({ bug, result: r }) => {
          const icon = r.status === "fixed" ? "✅" : r.status === "needs-clarification" ? "❓" : "❌";
          const filesSection = r.changedFiles.length > 0
            ? "\n" + r.changedFiles.map((f) => `  - \`${f.filePath}\``).join("\n")
            : r.filePath ? `\n  - \`${r.filePath}\`` : "";
          return `- [x] ${icon} ${bug.text.slice(0, 80)}\n  > ${r.rationale}${filesSection}`;
        })
        .join("\n");

      const prBody = `## QA Bug Fixes\n\n**Feature:** ${thread.feature} | **Platform:** ${thread.platform} | **Build:** ${thread.build ?? "unknown"}\n\n### Bugs\n\n${checklist}\n\n---\n*Auto-fixed by bug-pilot*`;

      const prUrl = await openDraftPR(branchName, prTitle, prBody, repoCtx);
      await sql`UPDATE threads SET status = 'done', pr_url = ${prUrl} WHERE id = ${threadId}`;

      if (dmTarget) {
        await sendDM(
          app.client,
          dmTarget,
          `✅ <${prUrl}|${prTitle}>\nFixed *${fixed.length}/${pendingBugs.length}* bugs${needsClarification.length > 0 ? `, ${needsClarification.length} need clarification` : ""} | ${dashLink}`
        );
      }
    } catch (err) {
      console.error(`execute flow failed: ${err}`);
      await sql`UPDATE threads SET status = 'no-fixes' WHERE id = ${threadId}`.catch(() => {});
    } finally {
      if (workDir) cleanupDir(workDir);
    }
  })();
});

// ── GITHUB WEBHOOK: auto-update LAST_PRS.md on PR merge ─────────────────────
import { createHmac, timingSafeEqual } from "crypto";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifyGithubSignature(rawBody: Buffer, sig: string): boolean {
  if (!GITHUB_WEBHOOK_SECRET) return true;
  if (!sig) return false;
  const hmac = createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const expected = `sha256=${hmac.digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

receiver.router.post("/github-webhook", express.raw({ type: "application/json" }), async (req: any, res: any) => {
  const sig = req.headers["x-hub-signature-256"] as string;
  if (!verifyGithubSignature(req.body, sig)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  const event = req.headers["x-github-event"];
  const payload = JSON.parse(req.body.toString());

  // Only handle merged PRs
  if (event !== "pull_request") return res.status(200).json({ ok: true, skipped: "not a PR event" });
  if (payload.action !== "closed" || !payload.pull_request?.merged) return res.status(200).json({ ok: true, skipped: "not merged" });

  const baseBranch = payload.pull_request.base?.ref;
  if (baseBranch !== "develop" && baseBranch !== "main") return res.status(200).json({ ok: true, skipped: `base branch is ${baseBranch}` });

  const repoFullName: string = payload.repository?.full_name; // "job-escape/jobescape-app"
  const [owner, repo] = repoFullName.split("/");

  res.status(202).json({ ok: true });

  void (async () => {
    try {
      console.log(`[webhook] PR #${payload.pull_request.number} merged into ${baseBranch} on ${repoFullName} — regenerating LAST_PRS.md`);
      await regenerateLastPRs(owner!, repo!, baseBranch);
    } catch (err) {
      console.error(`[webhook] failed to update LAST_PRS.md: ${err}`);
    }
  })();
});

async function regenerateLastPRs(owner: string, repo: string, baseBranch: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "bug-pilot" };

  // Fetch last 5 merged PRs targeting baseBranch
  const prsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&base=${baseBranch}&per_page=20&sort=updated&direction=desc`, { headers });
  const prs = await prsRes.json() as any[];
  const merged = prs.filter((p) => p.merged_at).slice(0, 5);

  if (merged.length === 0) {
    console.log(`[webhook] no merged PRs found, skipping`);
    return;
  }

  // Fetch changed files for each PR
  const prDetails: { pr: any; files: any[] }[] = [];
  for (const pr of merged) {
    const filesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files?per_page=100`, { headers });
    const files = await filesRes.json() as any[];
    prDetails.push({ pr, files });
  }

  // Generate LAST_PRS.md content
  const lines: string[] = [
    `# Last Merged PRs — High-Risk Change Map`,
    ``,
    `This file is auto-generated by bug-pilot on each PR merge. Use it as your primary map when no feature manifest exists — the bug almost certainly lives in one of these recently changed files.`,
    ``,
    `---`,
    ``,
  ];

  for (const { pr, files } of prDetails) {
    const date = pr.merged_at?.slice(0, 10) ?? "unknown";
    lines.push(`## PR #${pr.number} — ${pr.title} (${date})`);
    lines.push(``);
    if (pr.body?.trim()) {
      lines.push(`**Description**: ${pr.body.trim().slice(0, 300).replace(/\n/g, " ")}`);
      lines.push(``);
    }
    lines.push(`**Changed files**:`);
    for (const f of files) {
      const icon = f.status === "added" ? "NEW" : f.status === "removed" ? "DEL" : "mod";
      lines.push(`- \`${f.filename}\` — ${icon} (+${f.additions}/-${f.deletions})`);
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  const content = lines.join("\n");

  // Commit LAST_PRS.md via GitHub API
  const filePath = "LAST_PRS.md";
  const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // Get current SHA if file exists
  let sha: string | undefined;
  const existing = await fetch(`${fileUrl}?ref=${baseBranch}`, { headers });
  if (existing.ok) {
    const data: any = await existing.json();
    sha = data.sha;
  }

  const body: any = {
    message: `chore: update LAST_PRS.md [bot]`,
    content: Buffer.from(content).toString("base64"),
    branch: baseBranch,
  };
  if (sha) body.sha = sha;

  const commitRes = await fetch(fileUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`GitHub API error: ${commitRes.status} ${err}`);
  }

  console.log(`[webhook] LAST_PRS.md updated on ${baseBranch} (${merged.length} PRs)`);
}


await app.start(Number(PORT));
console.log(`bug-pilot listening on :${PORT}`);
