# OS Organizer

A personal command center for open source program prep (GSoC, LFX, Summer of Bitcoin, Outreachy, ESoC).

Every repo you target is a **line**. Every contribution is a **loop** that travels its stations:
**Ask → Approved → Issue → PR → Merged**. Repos that don't need an ask start later on the line.

## What it does

- **Today**: what needs you now, ranked. Covers review comments, failing checks, merge conflicts, claims about to lapse, asks with no reply, PRs waiting past the repo's usual reply time, and lines going cold. Includes a "Copy message" draft for polite follow-ups.
- **Lines**: the network map. Select a train to move it along, link the issue or PR, or drop it.
- **Repo pages**: timeline, presence over 8 weeks, maintainer rhythm (median time to first reply), a pre-PR checklist read from `CONTRIBUTING.md` and the PR template, people with their local time, setup notes, and a **proof pack** that copies your PRs as a Markdown table for proposals.
- **Inbox**: forwarded Discord messages, labelled Gmail threads and GitHub mentions. Filing one as an approval moves the waiting loop to *Approved*.
- **Programs**: a 12-month view of every program's dates, plus an `.ics` feed with claim deadlines.
- **⌘K**: jump anywhere, or paste a GitHub or Discord link to start a loop from it.

## Run it

```bash
pnpm install
cp .env.example .env      # fill in what you use
pnpm db:migrate
pnpm db:seed              # demo data with made-up orgs; clear it from Settings
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Migrates, then starts the app |
| `pnpm sync` | One GitHub sync (put it in cron every 15 min) |
| `pnpm bot` | Starts the Discord bot |
| `pnpm db:reset` | Wipes and reseeds demo data |
| `pnpm test:sync` | Offline test of the GitHub sync logic |
| `pnpm db:push-data` | Copies your local data into a hosted database |

## Deploy (free)

The web app runs on **Vercel** and the database on **Turso** (hosted libSQL, the same engine as the local file). Both have free plans.

1. **Database.** Create a Turso database and copy its URL (`libsql://…`) and a token. Then copy your local data across:
   ```bash
   TARGET_DATABASE_URL=libsql://… TARGET_DATABASE_AUTH_TOKEN=… pnpm db:push-data
   ```
   It migrates the hosted database first and refuses to overwrite rows unless you pass `--replace`.
2. **Web app.** Import the GitHub repo in Vercel. Add these environment variables: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APP_PASSWORD`, `SESSION_SECRET` (`openssl rand -base64 32`), `INGEST_SECRET`, `GITHUB_TOKEN`, and optionally `DISCORD_WEBHOOK_URL`. `vercel.json` runs migrations on each build. In Settings → Functions, set the region to the one nearest your Turso database.
3. **Gmail and sync.** In the Apps Script's properties, set `APP_URL` to your Vercel URL, then run `setup()` again. It forwards labelled mail every 5 minutes, syncs GitHub every 15 minutes and sends the morning briefing.
4. **Calendar.** Re-subscribe to the `.ics` feed from the Programs page, because its URL now uses the new domain.

Every page asks for `APP_PASSWORD`. Signing in lasts 30 days, and changing the password signs out every device. The `/api/*` routes still use `INGEST_SECRET`.

## Integrations

**GitHub.** Set `GITHUB_TOKEN` to a classic token with `notifications` and `read:user`. Sync pulls your PRs, issues and reviews per tracked repo and attaches them to loops. A PR that closes an issue joins that issue's loop. It also detects other people's PRs on issues you've claimed and reads contribution rules weekly.

**Discord.** Bots can't read servers they weren't added to, and self-bots break Discord's terms. So the bot lives in *your* private server: forward any maintainer message into your `#inbox` channel, and the bot files it and replies with buttons. Set the org's server ID on a repo, and messages from that server are matched to it automatically. `/today` lists the day's actions. Set `DISCORD_WEBHOOK_URL` for alerts on merges, requested changes, failing checks and claim collisions.

**Gmail.** `integrations/gmail/Code.gs` is an Apps Script that runs in your own Google account. It forwards threads labelled `os-organizer` every 5 minutes, with no OAuth app to verify. Use it for mailing lists, program emails and mentors. GitHub activity comes from the API instead.

**Endpoints** (all take `INGEST_SECRET` via the `x-ingest-secret` header or `?key=`):
`POST /api/inbox`, `POST /api/inbox/:id/file`, `GET|POST /api/sync`, `GET /api/today`, `GET /api/calendar`.

## Design

Theme "Platform": transit signage. Concrete page (`#E7EBEF`), signal-navy ink (`#14223D`), Barlow Condensed for names, stations and numerals, Atkinson Hyperlegible Next for body text. Repo line colors are a fixed 8-slot palette, validated for color-vision-deficiency separation in light and dark. Label text on each line color uses whichever of white or ink reads better. The one signature motion is a train sliding to its next station.

## Stack

Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4, Motion, Drizzle ORM on libSQL/SQLite, cmdk, discord.js.
