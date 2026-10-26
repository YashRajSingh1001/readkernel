# ReadKernel

The day's tech and AI news, boiled down to the stories that matter.

ReadKernel reads 56 tech and AI news sources, merges articles about the same
event into one story, ranks them, and writes a short summary for each one,
with every source linked. It is built to run at zero cost.

## Status

| Iteration | What | State |
| --- | --- | --- |
| 1 | News pipeline (fetch, filter, group, rank, summarise) | **working** |
| 1 | Database + website + daily email | **working**, live on Vercel |
| Phase 1 | Light/dark toggle, new homepage, story photos with credit, source icons, brief sections, listen | **built** |
| Phase 2 | Feed side menu + phone bottom bar, topic pages, Top articles, Model releases, 56 sources, Sources page | **built** |
| Phase 3 | Make it yours (topics, 5/10/15, format, daily/weekly) with live preview, preferences link in every email, Google sign-in, synced saves | **built** (sign-in needs setup) |
| Phase 4 | Blog, guides, newsletter reviews, compare, contact, privacy, terms | **built** |
| Phase 5 | Archive search, story timelines, weekly digest, Telegram, listen mode | **built** (Telegram needs a bot) |
| 2 | MCP server for AI assistants (read-only: brief, feed, archive search, story timelines) | **working** |
| 2 | Chrome new-tab extension | later |

## How the pipeline works

```
sources.yaml -> fetch -> filter -> group -> rank -> summarise -> Supabase + data/latest.json -> website
```

| Step | File | What it does |
| --- | --- | --- |
| Fetch | `kernel/fetch.py` | Downloads every feed in parallel. A broken feed is logged and skipped. |
| Filter | `kernel/filter.py` | Keeps the last 36 hours, drops deals and promos, removes duplicate links and titles. |
| Group | `kernel/group.py` | Local embeddings find look-alike articles. Clear matches merge; borderline ones are checked by the AI. |
| Rank | `kernel/rank.py` | Score = number of sources + source trust + freshness, nudged by an AI editor's 1-5 rating. Max 3 stories per topic. |
| Summarise | `kernel/summarise.py` | Headline, 2-3 sentence summary, "why it matters" and news/model-release per story, cached so each story is summarised once. |
| Photos | `kernel/images.py` | The publisher's own preview photo (RSS media or the page's og:image), shown from their site with a credit. |
| Threads | `kernel/threads.py` | Links a story to the same ongoing story on earlier days, for the "This story so far" timeline. |
| Top articles | `kernel/discussions.py` | The most-upvoted Hacker News posts, with a one-line summary each. |
| Email | `kernel/send.py`, `kernel/personal.py` | Each reader's own picks (topics, 5/10/15, format); daily, or weekly on Sundays. |
| Telegram | `kernel/telegram.py` | Posts the brief to a Telegram channel when a bot token is set. |

## Cost

| Piece | Choice | Cost |
| --- | --- | --- |
| AI | Groq free tier, running the open-weight GPT-OSS 120B model | free |
| Embeddings | `BAAI/bge-small-en-v1.5` via fastembed, on your CPU | free |
| Database | Supabase free tier (Postgres) | free |
| Website | Next.js on Vercel's free tier | free |
| Optional AI | Claude or OpenAI (`LLM_PROVIDER=claude` / `openai`) | paid, off by default |

Without any key the pipeline still runs: it uses the feed's own description
as the summary and skips the AI checks.

## Run it

```bash
cd pipeline
py -3.12 -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # macOS/Linux: .venv/bin/pip
cp ../.env.example ../.env                         # add your free GROQ_API_KEY
.venv/Scripts/python -m kernel.run                 # or: --no-ai, --top 15
.venv/Scripts/python -m pytest -q
```

Output goes to `pipeline/data/latest.json` and `pipeline/data/brief-YYYY-MM-DD.json`.

## Database (Supabase)

1. Create a free project at supabase.com.
2. Open **SQL Editor** and run each file in `db/migrations/` in order (`001_init.sql` to `004_phases.sql`).
3. From **Project Settings -> API**, copy:
   - the project URL and **secret** key into `.env` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`), for the pipeline
   - the project URL and **publishable** key into `web/.env.local` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), for the website

Anyone can read briefs; only the secret key can write (Row Level Security).
Without these settings, both sides fall back to local JSON files.

## Website

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

| Page | What |
| --- | --- |
| `/` | Today's brief (top 10), sign-up box |
| `/feed` | The whole day (~30 stories): topic tabs with counts, Top / Recent |
| `/story/<key>` | One story: summary, all coverage, share buttons, preview image for social |
| `/saved` | Stories saved on this device (browser storage, no account) |
| `/brief`, `/brief/YYYY-MM-DD` | Archive of every day's brief |
| `/how-it-works` | How ReadKernel picks and summarises stories |
| `/rss.xml`, `/sitemap.xml`, `/robots.txt` | For feed readers and search engines |

Pages are cached and refresh about once a minute, so a new pipeline run shows
up on its own.

## Daily email

How it works:

1. A reader enters their email on the home page.
2. They get a **confirmation email** and must click it (double opt-in), so nobody can sign up someone else.
3. Each morning `python -m kernel.send` emails the day's brief to everyone confirmed. Each send is logged, so re-running never emails anyone twice.
4. Every email has an unsubscribe link, plus the one-click unsubscribe button Gmail and Outlook show.

Confirm and unsubscribe links open a page with a button rather than acting
immediately, because email security scanners open every link.

```bash
cd pipeline
.venv/Scripts/python -m kernel.send --to you@example.com   # one test email
.venv/Scripts/python -m kernel.send --dry-run              # who would get today's brief
.venv/Scripts/python -m kernel.send                        # send it
```

Choose how mail goes out with `EMAIL_TRANSPORT` (in both `.env` and `web/.env.local`):

| Value | What happens | Cost |
| --- | --- | --- |
| `preview` | Nothing is sent. Pipeline saves `.eml` files to `pipeline/data/outbox/`; the website prints emails to its log | free |
| `smtp` | Real email through any SMTP server. Gmail with an app password allows ~500/day | free |
| `resend` | Resend's API. 3,000/month free; needs a domain you own | free |

## Deploy

```
GitHub Actions (06:00 IST daily) --writes--> Supabase <--reads-- Vercel (website)
        \--> emails subscribers
```

### Pipeline: GitHub Actions

`.github/workflows/daily-brief.yml` builds the brief and emails subscribers
every day at 06:00 India time. It reads its settings from the repo's
**Actions secrets**. Load them all from your local `.env`, then point
`SITE_URL` at the live site:

```bash
gh secret set -f .env
gh secret set SITE_URL --body "https://readkernel.in"
```

Run it by hand from the **Actions** tab (or `gh workflow run daily-brief.yml`).
Manual runs build the brief without emailing unless you tick "send_email".

### Website: Vercel

1. vercel.com -> **Add New -> Project** -> import this GitHub repo.
2. **Root Directory: `web`** (the framework is detected as Next.js).
3. **Environment Variables**: paste the contents of `web/.env.local`, but set
   `SITE_URL` to the Vercel address (or your domain).
4. **Deploy.** Every push to `main` redeploys automatically.

### Custom domain

Vercel project -> **Settings -> Domains** -> add the domain, then copy the
DNS records Vercel shows into your registrar. Afterwards update `SITE_URL` in
both Vercel and the GitHub secrets.

## Sign-in (optional)

Sign-in is off until you turn it on, so the site never shows a broken login.

1. Google Cloud Console: create an OAuth client (Web application). Authorised
   redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
2. Supabase: Authentication -> Sign In / Providers -> Google: paste the client
   ID and secret, enable it. Authentication -> URL Configuration: set Site URL
   to your live address and add `https://<your-site>/auth/callback` to the
   redirect URLs.
3. Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as the server ones) and
   `NEXT_PUBLIC_AUTH_ENABLED=1`. Redeploy.

## MCP server (for AI assistants)

`pipeline/kernel/mcp_server.py` lets Claude Code, Claude Desktop, Cursor or any
other MCP client read ReadKernel. It is read-only and reads the same data as
the website: Supabase with the **publishable** key, or `pipeline/data` files
when no database is set. It never uses the secret key.

| Tool | What it returns |
| --- | --- |
| `get_brief` | A day's top stories (latest by default), with summaries and sources |
| `get_feed` | The whole day's stories, optionally one topic |
| `search_stories` | Archive search over headlines and summaries |
| `get_story_thread` | One ongoing story, day by day |
| `list_editions` | The days that have a brief, with each lead headline |
| `get_top_discussions` | The day's top Hacker News posts |
| `list_sources` | The news sources and their topics |

It also serves the latest brief as the resource `readkernel://brief/latest`.

```bash
cd pipeline
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-mcp.txt   # Python 3.10+
# .env: SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (optional; otherwise local files)
claude mcp add readkernel -e PYTHONPATH="$PWD" -- "$PWD/.venv/bin/python" -m kernel.mcp_server
```

Then ask Claude Code something like "What's in today's ReadKernel brief?" or
"Find ReadKernel stories about open-weight models this week".

## Writing pages

Blog posts, guides and newsletter reviews are Markdown files in
`web/content/blog`, `web/content/guides` and `web/content/newsletters`. Copy
an existing file, change the front matter at the top and the text, push.

## Add or remove a source

Edit `pipeline/sources.yaml`. Each source needs a `name`, a feed `url`, a
`topic` (`ai`, `tech`, `dev`, `startups`, `security`, `markets`, `design`)
and optionally a `weight` and `exclude` words. Then refresh the list the
website shows: `cd pipeline && .venv/Scripts/python -m kernel.sources`.
