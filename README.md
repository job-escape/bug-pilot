# Bug-pilot

AI agent that reads QA bug threads from Slack, finds the right files in your GitHub repo, fixes the bugs, and opens a Pull Request — automatically.

**Flow:** Slack reaction → parse thread → dashboard review → execute → PR + DM

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- Node.js 18+ (for Next.js)
- PostgreSQL database (recommend [Neon](https://neon.tech) free tier)
- ffmpeg (for video frame extraction): `brew install ffmpeg`
- Slack app with bot token
- GitHub personal access token

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
bun run scripts/migrate.ts
```

### 4. Slack app setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. **OAuth & Permissions** → Bot Token Scopes: `channels:history`, `groups:history`, `reactions:read`, `chat:write`, `conversations:read`, `im:write`, `users:read`
3. **Event Subscriptions** → Enable, set Request URL: `https://your-bot-url/slack/events`
   - Subscribe to: `reaction_added`
4. Install app to workspace → copy Bot Token and Signing Secret to `.env`

### 5. GitHub webhook (for LAST_PRS.md auto-update)

In your target repo settings → Webhooks → Add webhook:
- Payload URL: `https://your-bot-url/github-webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET` in `.env`
- Events: **Pull requests** only

### 6. Run

```bash
bun run dev
```

Bot runs on `:3001`, dashboard on `:3000`.

Open `http://localhost:3000/setup` to add your first repo and configure settings.

## Project structure

```
src/
  server.ts          # Slack bot + /execute + /github-webhook
  agent/
    runner.ts        # fixBug() — Claude tool-use loop
    prompts.ts       # System prompt + context builder
    stack-templates.ts # Stack-specific prompt customization
  slack/             # Thread parsing, metadata extraction
  github/            # Clone, branch, commit, PR
  messaging/         # Slack DM notifications

dashboard/
  app/               # Next.js App Router pages
  components/        # BugCard, StatusBadge, etc.
  lib/db.ts          # PostgreSQL queries
```

## How it works

1. **Reaction** — user reacts with 🤖 to a Slack QA thread
2. **Parse** — Claude Haiku extracts metadata (feature, platform, build); each message classified as actionable / noise / not-fixable
3. **DM** — user gets a link to the dashboard with pending bugs
4. **Review** — skip bugs, add context, then click Execute
5. **Fix loop** — Claude Sonnet explores the repo with tools (read_file, search_file, list_directory) up to 12 rounds per bug
6. **PR** — branch pushed, draft PR opened with fix checklist
7. **DM** — user notified with PR link and stats

## Feature manifests (optional)

For faster fixes, create `.feature-memory/` in your target repo with `.md` files per feature:

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

The agent pre-loads matching files before starting, reducing exploration rounds significantly.
