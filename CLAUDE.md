# Bug-pilot — Claude Code Guide

## If a new user asks you to set up and run this project

Do this in order — don't skip steps:

1. **Install prerequisites** (if missing):
   ```bash
   # Check and install Bun
   which bun || curl -fsSL https://bun.sh/install | bash
   # Check and install ffmpeg
   which ffmpeg || brew install ffmpeg
   # Check and install ngrok
   which ngrok || brew install ngrok
   ```

2. **Install dependencies:**
   ```bash
   bun install
   cd dashboard && bun install && cd ..
   ```

3. **Ask the user for these keys** (you cannot get them yourself):
   - `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` — get from the bot owner, the Slack app is already set up
   - `GITHUB_TOKEN` — github.com → Settings → Developer settings → Personal access tokens → scopes: repo
   - `ANTHROPIC_API_KEY` — console.anthropic.com
   - `DATABASE_URL` — create free DB at neon.tech, copy connection string

   > If the Slack bot is already running in the user's workspace channel, they only need `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, and `DATABASE_URL`. Ask the bot owner for the Slack tokens.

4. **Fill env files:**
   ```bash
   cp .env.example .env
   cp dashboard/.env.local.example dashboard/.env.local
   # Write the keys into .env and dashboard/.env.local
   # Set BOT_URL=http://localhost:3001 in dashboard/.env.local
   # Set DASHBOARD_URL=http://localhost:3000 in .env
   ```

5. **Run database migration:**
   ```bash
   bun --env-file=.env scripts/migrate.ts
   ```

6. **Start ngrok** (in a separate terminal):
   ```bash
   ngrok http 3001
   ```
   Tell the user to copy the `https://xxxx.ngrok.io` URL and update the Slack app Event Subscriptions Request URL to `https://xxxx.ngrok.io/slack/events`.

7. **Start the app:**
   ```bash
   bun run dev
   ```

8. Open `http://localhost:3000/setup` and add the user's GitHub repo.

> Note: The Slack bot and workspace are already configured by the owner. The user only needs their own GitHub token and Anthropic key.

---

## What this project is

Bug-pilot is a Slack bot + AI agent + Next.js dashboard. It reads QA bug threads from Slack, fixes bugs in a GitHub repo using Claude, and opens a PR.

## Running locally

```bash
bun run dev        # starts bot (port 3001) + dashboard (port 3000) concurrently
bun run bot        # bot only
bun run dashboard  # dashboard only
```

Both `.env` (root) and `dashboard/.env.local` must be filled before running.

## Environment setup

```bash
cp .env.example .env
cp dashboard/.env.local.example dashboard/.env.local
# Fill in keys, then:
bun --env-file=.env scripts/migrate.ts
```

For Slack events to work locally, expose port 3001 via ngrok:
```bash
ngrok http 3001
# Set Request URL in Slack app: https://xxxx.ngrok.io/slack/events
```

## Architecture

```
src/server.ts          — Slack Bolt app (ExpressReceiver) + HTTP endpoints
  POST /execute        — called by dashboard to start fix loop
  POST /github-webhook — GitHub PR merge → regenerates LAST_PRS.md

src/agent/runner.ts    — fixBug(): clones repo, runs Claude tool-use loop
src/agent/prompts.ts   — buildInitialPrompt(): injects CLAUDE.md, LAST_PRS.md, manifests
src/agent/stack-templates.ts — per-stack system prompt customization

dashboard/             — Next.js App Router, Server Components only (no onClick on server)
dashboard/lib/db.ts    — all DB queries (postgres library)
```

## Key flows

**Parse (reaction_added):**
1. Fetch Slack thread replies
2. Claude Haiku extracts metadata (feature, platform, build, environment)
3. Classify each message: actionable / noise / not-fixable
4. Save bugs to DB with status `pending`
5. Send DM to user with dashboard link

**Execute (POST /execute from dashboard):**
1. Clone repo to temp dir, checkout new branch `fix/qa-{feature}-{date}`
2. For each pending bug: run fixBug() agent loop (max 12 rounds)
3. Claude tools: read_file, search_file, list_directory, submit_fix
4. Commit each fix, push branch, open draft PR
5. Send DM with PR link

## Database

PostgreSQL via `postgres` npm package. Tables: `settings`, `repos`, `threads`, `bugs`.

Schema: `src/db/schema.sql`  
Migration: `bun --env-file=.env scripts/migrate.ts`

## Important constraints

- Dashboard is Next.js App Router — Server Components only. No `onClick`, no `useState` on server components. Use `<form>` + server actions for interactivity.
- Bot uses `ExpressReceiver` (not default Bolt receiver) to support custom HTTP routes alongside Slack events.
- `stack_tags` in DB is stored as postgres array — comes back as string `"{tag1,tag2}"`, normalize before calling `.map()`.
- Slack file downloads require `Authorization: Bearer {SLACK_BOT_TOKEN}` header.
- Video attachments are extracted into frames via ffmpeg before passing to Claude API.
