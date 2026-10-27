# ReadKernel at a glance

The short version: what ReadKernel is, what happens every morning, and what it's built with.
For the full story, with the reasons behind every choice, read [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md).

---

## What it is

A **free daily tech and AI news brief** at [readkernel.in](https://readkernel.in).

Every morning it reads **56 news sites** and **30 company engineering blogs**, merges
articles about the same event into one story, ranks them, writes a short summary for
each, and publishes the result as a website, a daily email and (optionally) a Telegram post.

**It costs nothing to run.** Every service used is on a free tier, and the AI is an
open-weight model on Groq's free plan.

---

## The whole system on one page

```mermaid
flowchart LR
    subgraph IN["Where the news comes from"]
        N["56 news sites<br/>(RSS feeds)"]
        C["30 company blogs<br/>(RSS feeds)"]
        H["Hacker News search<br/>(Top articles + blogs with no feed)"]
    end

    subgraph ROBOT["GitHub Actions · every day at 6:00 AM IST"]
        P["Python pipeline"]
        AI["Groq AI<br/>gpt-oss-120b"]
        E["Local embeddings<br/>bge-small"]
        P <--> AI
        P <--> E
    end

    DB[("Supabase<br/>Postgres database")]

    subgraph OUT["What readers see"]
        W["Website<br/>readkernel.in<br/>(Next.js on Vercel)"]
        M["Daily email<br/>(Resend)"]
        T["Telegram<br/>(optional)"]
        X["Chrome new tab<br/>(extension)"]
        A["AI assistants<br/>(MCP server)"]
        Q["Ask ReadKernel<br/>(chat agent)"]
    end

    N --> P
    C --> P
    H --> P
    P --> DB
    DB --> W
    P --> M
    P --> T
    W -- "/api/v1/today" --> X
    W -- "/mcp" --> A
    W --> Q
    W -- "sign-ups, settings, watch alerts" --> DB
```

---

## What happens every morning

```mermaid
flowchart TD
    A["1. Fetch<br/>Download all 56 feeds at once"] --> B["2. Filter<br/>Keep the last 36 hours, drop deals and duplicates"]
    B --> C["3. Group<br/>Merge articles about the same event into one story"]
    C --> D["4. Rank<br/>Score by coverage + trust + freshness + AI editor"]
    D --> E["5. Summarise<br/>Headline, summary, why it matters"]
    E --> E2["6. Fact-check agent<br/>Every claim checked against the articles"]
    E2 --> F["7. Photos, timelines, Top articles"]
    F --> G["8. Save to the database"]
    G --> H["9. Company blogs<br/>Add only new posts, sort by subject"]
    H --> H2["10. Watch alerts agent<br/>Match news to what each reader asked for"]
    H2 --> I["11. Email every subscriber<br/>(alerts first, then their own picks)"]
    I --> J["12. Sunday: weekly digest · Telegram post"]
```

| Step | In one line |
| --- | --- |
| **Fetch** | Reads the free RSS "notice board" each site publishes. A broken site is skipped, not fatal. |
| **Filter** | Keeps the last 36 hours and drops deals, coupons, promos and repeated links. |
| **Group** | A small AI model on the computer spots look-alike headlines. Groq double-checks the unclear ones. |
| **Rank** | More outlets + more trusted outlets + newer = higher. An AI "editor" nudges each story up or down. |
| **Summarise** | Groq writes the headline, a 2–3 sentence summary and "why it matters". Each story is summarised once and remembered. |
| **Fact-check** | A second AI pass checks every claim against the articles; unsupported text is rewritten and re-checked, or replaced by the publisher's own words. |
| **Photos** | The publisher's own preview photo (the one WhatsApp shows), loaded from their site with credit. |
| **Timelines** | Links today's story to the same ongoing story on earlier days ("This story so far"). |
| **Top articles** | The most-upvoted Hacker News posts of the day, one line each. |
| **Company blogs** | New engineering posts only (never saved twice), sorted into 7 subjects, rated for depth. |
| **Watch alerts** | Readers describe what to watch in plain English; the agent shortlists likely stories for free, then the AI confirms real matches. |
| **Email** | Each reader gets their watch alerts first, then their own picks, plus one company blog read unless they turned it off. |

## The agents and integrations

| What | Where | What it does |
| --- | --- | --- |
| **Ask ReadKernel** | [readkernel.in/ask](https://readkernel.in/ask) | A chat. The AI decides which tools to use (search, open a story's timeline, read today's brief), loops until it can answer, and links every fact. |
| **Fact-check agent** | Every morning | Checks, rewrites and re-checks summaries before anything is published. |
| **Watch alerts agent** | Every morning, on the settings page | Matches each day's news against each reader's plain-English wishes. |
| **MCP server** | `https://readkernel.in/mcp` | Lets Claude, Cursor and other AI assistants use ReadKernel's 6 news tools. |
| **Chrome extension** | `extension/` folder | Today's brief in every new tab, offline-ready. |
| **Public API** | `/api/v1/today` | Today's brief as JSON (used by the extension). |

All of them share **one set of six news tools** (`web/lib/tools.ts`), so the chat, the MCP server and future agents behave the same.

---

## The building blocks

| Part | What we use | Why, in one line |
| --- | --- | --- |
| **Pipeline language** | Python 3.12 | Best tools for reading feeds and working with AI. |
| **Main AI** | Groq · `openai/gpt-oss-120b` (open-weight) | Free, fast and good enough to write clean summaries. |
| **Backup AI** (off) | Claude Haiku 5.5 or GPT-5 mini | Paid; one setting switches to them if Groq ever fails. |
| **Duplicate finder** | `BAAI/bge-small-en-v1.5` via fastembed | Runs free on the computer, so grouping costs no AI calls. |
| **Database** | Supabase (Postgres), Tokyo region | Free, real SQL, built-in security rules and full-text search. |
| **Website** | Next.js 16 + React 19 + Tailwind CSS 4 | Fast pages, cached, easy to host free. |
| **Hosting** | Vercel | Free, rebuilds the site automatically on every `git push`. |
| **Domain** | readkernel.in (GoDaddy, DNS on Vercel) | Own name; also needed to send email from our own address. |
| **Daily robot** | GitHub Actions (cron `30 0 * * *`) | Free scheduler that runs the pipeline at 6:00 AM IST. |
| **Email** | Resend, from `brief@readkernel.in` | Free 3,000/month; lands in inboxes better than Gmail. |
| **Replies** | Go to `readkernel.brief@gmail.com` | The domain address can send but has no inbox. |
| **Chat channel** | Telegram bot (optional) | Free; posts the brief once a bot token is added. |

**Monthly cost: ₹0.** The only paid item is the domain (about ₹899 a year after the first year).

---

## Where things live

```
readkernel/
├── pipeline/            Python: everything that runs at 6 AM
│   ├── sources.yaml         the 56 news sites
│   ├── company_blogs.yaml   the 30 company blogs
│   ├── kernel/              one file per step (fetch.py, group.py, rank.py ...)
│   └── tests/               53 automatic checks
├── web/                 Next.js website (readkernel.in)
├── db/migrations/       6 SQL files that create the database tables
├── extension/           Chrome new-tab extension (plain HTML, CSS, JS)
├── docs/                these documents
└── .github/workflows/   the 6 AM schedule
```

---

## What's built and what's next

| Built | Still to do |
| --- | --- |
| Daily brief, full feed, topic pages, Top articles | Publish the extension on the Chrome Web Store ($5 one-time) |
| Company blogs with subjects and depth rating | Google sign-in (built, needs switching on) |
| Personal email (topics, 5/10/15, format, daily/weekly) | Telegram channel (built, needs a bot) |
| Archive, search, story timelines, saved stories | Later agent ideas: story deep-dive, weekly analyst, source scout, run doctor |
| Ask ReadKernel, fact-check agent, watch alerts | |
| MCP server, Chrome extension, public API | |
| Blog, guides, newsletter reviews, legal pages | |
