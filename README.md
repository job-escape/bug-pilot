# Bug-pilot

AI agent that reads QA bug threads from Slack, finds the right files in your GitHub repo, fixes the bugs, and opens a Pull Request — automatically.

**Flow:** Slack reaction → parse thread → dashboard review → execute → PR + DM

---

## Option A — Use an existing instance

If someone has already set up bug-pilot and invited you to their Slack workspace:

1. Ask the owner to add your repo at `http://their-dashboard/setup`
2. React with 🤖 to any QA thread in the allowed Slack channel
3. You'll get a DM with a link to review and execute fixes

That's it — no setup needed.

---

## Option B — Run your own instance

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [ffmpeg](https://ffmpeg.org): `brew install ffmpeg`
- [ngrok](https://ngrok.com): `brew install ngrok`
- PostgreSQL — recommend [Neon](https://neon.tech) free tier
- Slack workspace where you can create apps
- GitHub personal access token (repo read + write)
- Anthropic API key

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

Fill in `.env` with your keys. In `dashboard/.env.local` set the same `DATABASE_URL` and `GITHUB_TOKEN`, plus `BOT_URL=http://localhost:3001`.

### 3. Expose bot to the internet (required for Slack)

```bash
ngrok http 3001
```

Copy the `https://xxxx.ngrok.io` URL — you'll need it for Slack setup.

### 4. Database migration

```bash
bun --env-file=.env scripts/migrate.ts
```

### 5. Slack app setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch
2. **OAuth & Permissions** → Bot Token Scopes:
   - `channels:history`, `groups:history`, `channels:read`
   - `reactions:read`
   - `chat:write`, `im:write`
   - `users:read`
3. **Event Subscriptions** → Enable → Request URL: `https://xxxx.ngrok.io/slack/events`
   - Subscribe to bot events: `reaction_added`
4. **Install app to workspace** → copy **Bot Token** and **Signing Secret** to `.env`

### 6. GitHub webhook (optional)

In your target repo → Settings → Webhooks → Add webhook:
- Payload URL: `https://xxxx.ngrok.io/github-webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET` in `.env`
- Events: **Pull requests** only

### 7. Run

```bash
bun run dev
```

Bot on `:3001`, dashboard on `:3000`.

Open `http://localhost:3000/setup` to add your first repo and configure settings (trigger emoji, allowed channels).

---

## How it works

1. **Reaction** — user reacts with 🤖 to a Slack QA thread
2. **Parse** — Claude Haiku extracts metadata; messages classified as actionable / noise / not-fixable
3. **DM** — user gets a dashboard link with pending bugs
4. **Review** — skip bugs, add thread context, click Execute
5. **Fix loop** — Claude Sonnet explores the repo with tools up to 12 rounds per bug
6. **PR** — draft PR opened with checklist of fixes and rationale per bug
7. **DM** — user notified with PR link and stats

## Project structure

```
src/
  server.ts            # Slack bot + /execute + /github-webhook
  agent/
    runner.ts          # fixBug() — Claude tool-use loop
    prompts.ts         # System prompt + context builder
    stack-templates.ts # Stack-specific prompt customization
  slack/               # Thread fetching, metadata parsing
  github/              # Clone, branch, commit, push, PR
  messaging/           # Slack DM notifications
  memory/              # Feature manifest loader
  db/                  # Schema + PostgreSQL client

dashboard/
  app/                 # Next.js App Router pages
  components/          # BugCard, StatusBadge, etc.
  lib/db.ts            # Database queries
```

## Feature manifests (optional, for faster fixes)

Create `.feature-memory/` in your target repo with `.md` files per feature:

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

Without manifests the agent falls back to `LAST_PRS.md` (auto-generated on each PR merge via GitHub webhook).
