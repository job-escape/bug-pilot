# Bug-pilot

AI agent that reads QA bug threads from Slack, finds the right files in your GitHub repo, fixes the bugs, and opens a Pull Request — automatically.

**Flow:** Slack reaction → parse thread → dashboard review → execute → PR + DM

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- PostgreSQL database (recommend [Neon](https://neon.tech) free tier)
- ffmpeg (for video frame extraction): `brew install ffmpeg`
- Slack app with bot token
- GitHub personal access token
- Anthropic API key

## Setup

### 1. Clone and install

```bash
git clone https://github.com/job-escape/bug-pilot
cd bug-pilot
bun install
cd dashboard && bun install && cd ..
```

### 2. Environment variables

```bash
cp .env.example .env
cp dashboard/.env.local.example dashboard/.env.local
```

Fill in both files. See comments in each file for details.

### 3. Database migration

```bash
bun scripts/migrate.ts
```

### 4. Slack app setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch
2. **OAuth & Permissions** → Bot Token Scopes, add:
   - `channels:history` — read public channel messages
   - `groups:history` — read private channel messages
   - `channels:read` — list channels
   - `reactions:read` — receive reaction events
   - `chat:write` — send messages
   - `im:write` — open DM conversations
   - `users:read` — look up user info
3. **Event Subscriptions** → Enable events → Request URL: `https://your-bot-url/slack/events`
   - Subscribe to bot events: `reaction_added`
4. Install app to workspace → copy **Bot Token** and **Signing Secret** to `.env`

### 5. GitHub webhook (for LAST_PRS.md auto-update)

In your **target repo** settings → Webhooks → Add webhook:
- Payload URL: `https://your-bot-url/github-webhook`
- Content type: `application/json`
- Secret: same value as `GITHUB_WEBHOOK_SECRET` in `.env`
- Events: select **Pull requests** only (uncheck Pushes)

### 6. Run

```bash
bun run dev
```

Bot runs on `:3001`, dashboard on `:3000`.

Open `http://localhost:3000/setup` to add your first repo and configure settings (trigger emoji, allowed channels, allowed user).

## Project structure

```
src/
  server.ts            # Slack bot + /execute + /github-webhook endpoints
  agent/
    runner.ts          # fixBug() — Claude tool-use loop (max 12 rounds)
    prompts.ts         # System prompt + context builder
    stack-templates.ts # Stack-specific prompt customization
  slack/               # Thread fetching, metadata parsing (Claude Haiku)
  github/              # Clone, branch, commit, push, open PR
  messaging/           # Slack DM notifications
  memory/              # Feature manifest loader
  db/                  # Schema + PostgreSQL client

dashboard/
  app/                 # Next.js App Router pages
  components/          # BugCard, StatusBadge, etc.
  lib/db.ts            # Database queries
```

## How it works

1. **Reaction** — user reacts with 🤖 to a Slack QA thread
2. **Parse** — Claude Haiku extracts metadata (feature, platform, build); each message classified as actionable / noise / not-fixable
3. **DM** — user receives a link to the dashboard with pending bugs
4. **Review** — skip bugs, add thread context, then click Execute
5. **Fix loop** — Claude Sonnet explores the repo with tools (`read_file`, `search_file`, `list_directory`) up to 12 rounds per bug
6. **PR** — branch pushed, draft PR opened with checklist of fixes and rationale per bug
7. **DM** — user notified with PR link and stats (fixed / needs-clarification)

## Feature manifests (optional, for faster fixes)

Create a `.feature-memory/` directory in your **target repo** with `.md` files per feature:

```markdown
---
title: Onboarding redesign
pr: 123
date: 2024-05-01
features: onboarding, signup
---

## Changed Files
- src/screens/Onboarding.tsx
- src/hooks/useOnboarding.ts
```

The agent pre-loads matching files before starting, reducing exploration rounds significantly. Without manifests the agent falls back to `LAST_PRS.md` (auto-generated on each PR merge).
