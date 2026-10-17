# ReadKernel

The day's tech and AI news, boiled down to the stories that matter.

ReadKernel reads about 30 tech news feeds, merges articles about the same
event into one story, ranks them, and writes a short summary for each one,
with every source linked. It is built to run at zero cost.

## Status

| Iteration | What | State |
| --- | --- | --- |
| 1 | News pipeline (fetch, filter, group, rank, summarise) | **working** |
| 1 | Database + website (feed, topic filter, daily archive) | **working** (Supabase not yet connected) |
| 1 | Daily email | next |
| 2 | Chrome new-tab extension, MCP server for AI assistants | later |

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
| Summarise | `kernel/summarise.py` | Headline, 2-3 sentence summary and "why it matters" per story, cached so each story is summarised once. |

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
2. Open **SQL Editor**, paste `db/migrations/001_init.sql`, and run it.
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
| `/` | Latest brief, with a topic filter |
| `/brief` | Archive of every day |
| `/brief/YYYY-MM-DD` | One day's brief |

Pages are cached and refresh about once a minute, so a new pipeline run shows
up on its own.

## Add or remove a source

Edit `pipeline/sources.yaml`. Each source needs a `name`, a feed `url`, a
`topic` (`ai`, `tech`, `dev`, `startups`, `security`, `markets`, `design`)
and optionally a `weight` and `exclude` words.
