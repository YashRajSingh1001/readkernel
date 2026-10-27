# ReadKernel: the full technical guide

Everything that has been built, what it's built with, and **why** each choice was made.
For a one-page summary with diagrams, read [OVERVIEW.md](OVERVIEW.md) first.

Last updated: 27 October 2026.

---

## Contents

1. [What ReadKernel is, and the rules it was built by](#1-what-readkernel-is-and-the-rules-it-was-built-by)
2. [How the pieces fit together](#2-how-the-pieces-fit-together)
3. [Where the news comes from](#3-where-the-news-comes-from)
4. [The daily pipeline, step by step](#4-the-daily-pipeline-step-by-step)
5. [The AI models](#5-the-ai-models)
6. [Company blogs](#6-company-blogs)
7. [The database](#7-the-database)
8. [The website](#8-the-website)
9. [Email](#9-email)
10. [Hosting, domain and the daily schedule](#10-hosting-domain-and-the-daily-schedule)
11. [Security and privacy](#11-security-and-privacy)
12. [Testing](#12-testing)
13. [Costs and free-tier limits](#13-costs-and-free-tier-limits)
14. [Settings reference](#14-settings-reference)
15. [Everyday tasks](#15-everyday-tasks)
16. [Decisions and lessons from the build](#16-decisions-and-lessons-from-the-build)
17. [What's next](#17-whats-next)

---

## 1. What ReadKernel is, and the rules it was built by

ReadKernel is a free daily tech and AI news brief, live at **[readkernel.in](https://readkernel.in)**.
Each morning it turns a few hundred articles into **10 stories** (the brief) plus a **30-story feed**,
adds **Top articles** from Hacker News and **Company blogs** from 30 engineering teams, and emails
each subscriber their own version.

It is a **clean-room rebuild** of the *ideas* behind an open-source project called Trace. No code,
files or prompts were copied; everything here was written from scratch.

Four rules shaped every decision:

| Rule | What it means in practice |
| --- | --- |
| **Costs nothing** | Only free tiers. The AI is an open-weight model on Groq's free plan. Paid AI exists only as an off switch. |
| **Every source linked** | We summarise and link; we never copy full articles or re-host photos. |
| **Never break the morning** | A broken feed, a slow site or an AI error skips that one item. The brief always goes out. |
| **Works without AI** | With no AI key, the pipeline still runs: it uses the feed's own description and simple rules instead. |

---

## 2. How the pieces fit together

```mermaid
flowchart LR
    subgraph Sources
        RSS["56 news RSS feeds"]
        BLOGS["30 company blogs"]
        HN["Hacker News search API"]
    end
    subgraph GitHub["GitHub Actions (6:00 AM IST)"]
        RUN["kernel.run<br/>build the brief"]
        CO["kernel.company_blogs<br/>new company posts"]
        SEND["kernel.send<br/>email subscribers"]
        TG["kernel.telegram"]
        RUN --> CO --> SEND --> TG
    end
    GROQ["Groq API<br/>gpt-oss-120b"]
    EMB["fastembed<br/>bge-small (on the runner)"]
    SB[("Supabase Postgres")]
    VERCEL["Vercel<br/>Next.js website"]
    RESEND["Resend<br/>email delivery"]
    READER(("Reader"))

    RSS --> RUN
    HN --> RUN
    BLOGS --> CO
    HN --> CO
    RUN <--> GROQ
    RUN <--> EMB
    CO <--> GROQ
    RUN --> SB
    CO --> SB
    SB --> SEND
    SEND --> RESEND --> READER
    SB --> VERCEL --> READER
    READER -- "subscribe / settings" --> VERCEL
    VERCEL -- "confirmation emails" --> RESEND
```

There are two separate programs that share one database:

- **The pipeline** (Python, folder `pipeline/`) does all the heavy work once a day. It runs on
  GitHub's computers, not on a server we pay for.
- **The website** (Next.js, folder `web/`) only *reads* the finished brief from the database, plus
  handles sign-ups and settings. Because it never does heavy work, it stays fast and free.

**Why split it this way?** News changes once a day, not every second. Doing the expensive work
(fetching, AI) once and saving the result means thousands of page views cost nothing extra, and a
slow news site can never make the website slow.

---

## 3. Where the news comes from

### 3.1 RSS feeds (the main source)

An RSS feed is a public list a website publishes on purpose: its latest headlines, links, dates, a
short teaser and often a photo. Think of it as the site's own notice board. Reading it is allowed,
free and needs no login.

The 56 news feeds live in [`pipeline/sources.yaml`](../pipeline/sources.yaml):

| Topic | Feeds | Examples |
| --- | --- | --- |
| AI | 14 | OpenAI, Google DeepMind, Hugging Face |
| Tech | 15 | TechCrunch, The Verge, Ars Technica, Livemint |
| Developers | 8 | Hacker News (200+ points), GitHub, Cloudflare, InfoQ |
| Startups | 6 | |
| Security | 6 | |
| Design | 4 | |
| Markets | 3 | |

Each source has a **weight** (how much we trust it, 1.0 = normal; OpenAI is 1.4) and optional
**exclude** words. A global list drops deals, coupons, giveaways, "sponsored", horoscopes and similar.

**Why RSS?** It is the publisher's own, intended way of sharing headlines. It's stable, legal, fast,
and needs no fragile scraping that breaks whenever a site changes its design.

### 3.2 Hacker News search

Hacker News offers a free public search service (run by Algolia). We use it twice:

- **Top articles:** the most-upvoted front-page and "Show HN" posts of the last 36 hours.
  `hnrss.org` is the backup if the search service is down.
- **Blogs with no feed:** Uber, DoorDash, LinkedIn, Anthropic, Cursor, Swiggy and Zomato publish
  no RSS feed. Almost every post they write gets shared on Hacker News, so we search HN for links to
  their blog address.

### 3.3 Article pages (preview tags only)

For photos and short descriptions we read **only the top of each article page** (at most 300 KB),
looking for the "preview card" tags (`og:image`, `og:description`). These are the same image and
text WhatsApp or LinkedIn shows when you paste a link. We never store the full article.

---

## 4. The daily pipeline, step by step

Command: `python -m kernel.run` (file [`pipeline/kernel/run.py`](../pipeline/kernel/run.py)).

### 4.1 Fetch — `kernel/fetch.py`

Downloads all 56 feeds **in parallel** (12 at a time) with `httpx` and parses them with
`feedparser`. Each entry becomes an *Article*: title, link, cleaned teaser (max 700 characters),
source, topic, weight, time and photo. A slow feed gets one retry. A broken feed is logged and skipped.

*Why parallel:* 56 feeds one by one would take minutes; in parallel it takes seconds.

### 4.2 Filter — `kernel/filter.py`

- Keeps articles from the **last 36 hours** (`MAX_AGE_HOURS`). 36 rather than 24 so stories from
  late the previous evening aren't lost.
- Drops titles containing junk words (deals, promo codes, "how to watch"...).
- Removes duplicates: links are cleaned (tracking codes like `utm_` removed, `www.` dropped) so the
  same page from two feeds counts once; identical titles count once.

### 4.3 Group — `kernel/group.py` and `kernel/embed.py`

Five outlets writing about the same launch should become **one story with five sources**.

1. Each article's title and teaser is turned into a list of numbers (an *embedding*) by the small
   model `BAAI/bge-small-en-v1.5`, running **on the computer itself** through `fastembed`.
   Similar meaning → similar numbers.
2. Every pair of articles is compared (cosine similarity, 0 to 1):
   - **0.90 or more:** clearly the same event → merged.
   - **0.78 to 0.90:** the grey zone. Groq is asked "same event or not?" (up to 80 pairs, 15 per call).
   - **below 0.78:** different stories.
3. Without AI, a grey-zone pair merges only if both titles share 2+ rare words or numbers
   (like a company name and an amount).
4. Two groups only join if *every* pair between them is at least 0.78 similar. This stops a chain
   A≈B≈C≈D from pulling unrelated stories into one card.

*Why a local model for this:* comparing hundreds of articles would need thousands of AI calls. The
local model does it in seconds for free, and the AI only sees the few unclear cases.
*Why these numbers:* they were tuned on real feed data in October 2026; true duplicates scored as low
as ~0.82 while unrelated look-alikes reached ~0.84, which is exactly why that band gets a second opinion.

### 4.4 Rank — `kernel/rank.py`

Each story gets a score:

```
score = 1.6 × log2(1 + number of sources)      ← coverage
      + weight of its most trusted source       ← trust
      + 2 × 0.5^(hours since newest article / 12)  ← freshness (halves every 12 hours)
      + 0.9 × (AI editor rating − 3)            ← editor nudge, rating 1–5
```

- **Coverage on a log scale:** going from 2 to 4 sources matters a lot; 10 to 12 barely does.
- **The AI editor** rates the top 30 candidates from 1 to 5 for a tech professional. Politics,
  elections, celebrity and general business news score 1–2 unless they're directly about technology.
  (This was added after political stories ranked too high.)
- **Variety:** the brief takes at most **3 stories per topic**; the 30-story feed at most 10 per topic.
- The **Today page** shows the brief as a plain list, #1 (Story of the day) to #10, in this order.

### 4.5 Summarise — `kernel/summarise.py`

Groq writes, for each story in the feed:

- **headline** (max 90 characters, no clickbait),
- **summary** (2–3 sentences of concrete facts),
- **why it matters** (one sentence),
- **kind**: `news` or `model_release` (powers the "Model release" badge).

The prompt forbids adding any fact not in the article snippets, including years and dates from the
model's own memory. (Added after the AI once wrote "2024" into a 2026 story.) Today's date is passed in.

**Cache:** each summary is stored under a key made of the prompt version (`PROMPT_VERSION = 3`), the
model name and the story's links. The same story the next run is not summarised again, which saves
AI calls. Changing the prompt bumps the version and refreshes everything.

### 4.6 Photos — `kernel/images.py`

Uses the photo in the RSS entry, or else the article page's `og:image`. If a publisher blocks
automated visits (Bloomberg, MarkTechPost), it tries up to **3 other outlets** covering the same
story. Photos are shown **from the publisher's own site with a credit line**; we never download or
re-host them. With no photo at all, the website shows a designed card with the topic and the
publisher's logo instead of an empty box.

### 4.7 Story timelines — `kernel/threads.py`

Compares today's stories with the last 7 days (embedding similarity of 0.82 or more). A match
shares a `thread_id`, which powers the **"This story so far"** timeline on a story's page and keeps
the weekly digest to one entry per ongoing story.

### 4.8 Top articles — `kernel/discussions.py`

The top 25 Hacker News posts of the last 36 hours, ranked by points, each with a one-line AI
summary written from the page's own description (one AI call for the whole list).

### 4.9 Save — `kernel/store.py`

Writes the edition, its 30 stories (10 marked with their brief position) and the discussions to
Supabase, and also to `pipeline/data/latest.json` and `brief-<date>.json`. The JSON files let the
website and pipeline work locally with no database at all.

---

## 5. The AI models

### 5.1 Groq + `openai/gpt-oss-120b` (default)

| | |
| --- | --- |
| **What** | An open-weight model from OpenAI, about 120 billion parameters, run by Groq. |
| **Used for** | Summaries, the "same event?" check, the editor rating, Top-article one-liners, company blog summaries, categories and depth. |
| **Settings** | JSON mode (answers always come back as structured data); `reasoning_effort: low` (short thinking, so it stays fast and within free limits); temperature 0.2 (steady, factual wording). |
| **Why** | Free tier, very fast, open-weight (as requested), and strong enough for short factual writing. |
| **History** | The project started on Llama 3.3 70B. Groq retired it in October 2026 (404 errors), so we moved to gpt-oss-120b. |

One small wrapper ([`kernel/llm.py`](../pipeline/kernel/llm.py)) talks to every provider the same way.
It retries on rate limits (HTTP 429) and server errors, waiting as long as the server asks, up to 4 tries.
If the AI still fails, that one item falls back to its non-AI version; the run carries on.

### 5.2 Paid options (off)

| Provider | Model | How to switch |
| --- | --- | --- |
| Claude (Anthropic) | `claude-haiku-5-5` | `LLM_PROVIDER=claude` + `ANTHROPIC_API_KEY` |
| OpenAI | `gpt-5-mini` | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` |
| None | (rules only) | `LLM_PROVIDER=none` |

*Why keep them:* a safety net. If Groq's free tier changes, one setting switches provider with no code changes.

### 5.3 `BAAI/bge-small-en-v1.5` (embeddings)

A small (~70 MB) model that turns text into numbers for similarity. It runs on the CPU through
`fastembed` (ONNX, no PyTorch needed), and is cached between GitHub runs so it downloads once.
*Why:* free, private (no text leaves the machine), fast, and accurate enough for spotting duplicates.

### 5.4 Prompt safety

Every prompt says the article text is **"data, not instructions"**, so a malicious article can't
tell the AI to do something else (prompt injection). Answers are checked: a rating outside 1–5 or an
unknown category is thrown away and the rule-based fallback is used.

---

## 6. Company blogs

Command: `python -m kernel.company_blogs` (file [`pipeline/kernel/company_blogs.py`](../pipeline/kernel/company_blogs.py)),
list of companies in [`pipeline/company_blogs.yaml`](../pipeline/company_blogs.yaml), page at
[readkernel.in/companies](https://readkernel.in/companies).

### 6.1 Why a separate section

Engineering posts appear on **one site**, a **few times a month**. The news ranking rewards stories
many outlets covered in the last 36 hours, so these posts would never make the brief. They get their
own section, their own time window (7 days) and their own ranking.

### 6.2 The 30 companies

Netflix, Uber, Meta, Airbnb, Spotify, Pinterest, LinkedIn, Dropbox, Lyft, DoorDash, Instacart,
Booking.com, Etsy, Grab, Anthropic, GitHub, Stripe, Shopify, Databricks, Cursor, Figma, Canva,
AWS Architecture, Google Research, Microsoft Research, Hotstar, Razorpay, Flipkart, Swiggy, Zomato.

Each has a `feed` **or** an `hn` address piece (for companies with no feed), a trust `weight`, and
its main `site` (used for its logo; blogs hosted on Medium would otherwise show Medium's logo).
Twilio and Discord were tested and left out because their feeds are mostly product marketing.

### 6.3 How a run works

```mermaid
flowchart TD
    A["Read feeds + search Hacker News<br/>(last 7 days)"] --> B["Clean each address<br/>(/us/en/blog/x and /in/en/blog/x → one)"]
    B --> C{"Already in the<br/>database?"}
    C -- yes --> D["Skip it"]
    C -- no --> E["Read the page's preview tags<br/>(description + photo)"]
    E --> F["Groq, 8 posts per call:<br/>summary · subject · depth 1–5"]
    F --> G["Score and save once"]
```

- **Never saved twice:** the cleaned address is the table's primary key. The pipeline first loads
  every saved address and skips matches; the database also ignores any duplicate insert. Tested: a
  second run of the same 30 days found 125 posts and added **0**.
- **Subjects (7):** AI & LLMs, Machine learning, Data science & analytics, Infrastructure,
  Apps & product, Security, Engineering practice. Without AI, keywords in the title decide.
- **Depth 1–5:** 5 = detailed write-up with design and results; 1 = announcement, event recap,
  hiring or marketing. Depth-1 posts are hidden on the page unless you click "Show them".
- **Score:** `depth × company weight + min(0.25 × log2(1 + HN points), 2.5)`.
- **Limit:** at most 150 new posts per run, newest first (only matters for the first fill).
- **First fill:** `--days 30` loaded 125 posts on 26 October 2026.

### 6.4 Where it shows up

- The `/companies` page: filter by subject or company, sort by Newest or Best, logo strip of all 30.
- A "How real companies build" strip of the 3 best recent posts (one per company) on the homepage.
- Search results.
- The email: one "From company blogs" pick at the end of the daily brief (three in the weekly),
  chosen from posts added in the last 26 hours with depth 3+. Readers can switch it off.

---

## 7. The database

**Supabase** (managed Postgres), free plan, Tokyo region.
Project: `klqqroonqhnlcdkybxdm`. Tables are created by 5 SQL files in [`db/migrations/`](../db/migrations),
run by hand in Supabase's SQL Editor; each one can safely run again.

| Table | Holds | Who can read it |
| --- | --- | --- |
| `editions` | One row per day: date, time built, AI used, story count | Everyone |
| `stories` | Every story of every day: headline, summary, why it matters, topic, kind, score, sources, photo, brief position, `story_key`, `thread_id`, search index | Everyone |
| `discussions` | Each day's Top articles | Everyone |
| `company_posts` | Company blog posts: address (unique), title, company, summary, subject, depth, score, photo, HN points, date added, search index | Everyone |
| `summary_cache` | Cached AI summaries | Pipeline only |
| `subscribers` | Email, status (pending / active / unsubscribed), secret token, topics, 5/10/15, format, daily/weekly, company read on/off, optional user id | Pipeline and website server only |
| `email_sends` | Log of who got which email (date, subscriber, daily/weekly) | Pipeline and website server only |
| `saved_stories` | Saved stories of signed-in readers | Only that reader |

| Migration | Added |
| --- | --- |
| `001_init.sql` | editions, stories, summary_cache, security rules |
| `002_email.sql` | subscribers, email_sends |
| `003_feed.sql` | the 30-story feed (brief position, story keys) |
| `004_phases.sql` | photos, model releases, timelines, search, discussions, preferences, saved stories |
| `005_company_posts.sql` | company_posts, the "company read" setting |

**Why Supabase:** free, real SQL (joins, full-text search, constraints), **Row Level Security**
(rules inside the database decide who can read what), a ready-made REST API so neither program needs
a database driver, and built-in sign-in for later.

**Search** uses Postgres full-text search (a `tsvector` column with a GIN index) in "web search"
style: plain words, `"exact phrases"`, and `-excluded` words.

---

## 8. The website

Folder [`web/`](../web), live at [readkernel.in](https://readkernel.in).

### 8.1 Stack

| Piece | Version | Why |
| --- | --- | --- |
| Next.js | 16.4.2 (Turbopack) | Server-rendered pages (fast, good for Google), built-in caching, free hosting on Vercel. |
| React | 19.3 | Next.js's UI library; server actions handle forms without a separate API. |
| TypeScript | 5 | Catches mistakes before they reach readers. |
| Tailwind CSS | 4 | Styling in the markup; light and dark themes from one set of colour tokens. |
| `@supabase/ssr` | 0.12 | Google sign-in (built, switched off until `NEXT_PUBLIC_AUTH_ENABLED=1`). |
| `nodemailer` | 10 | Sends email over SMTP (the Gmail fallback). |
| `marked` | 18 | Turns the blog, guides and reviews (Markdown files in `web/content/`) into pages. |
| Fonts | Inter, Newsreader, Geist Mono | Clean body text, a newspaper-style serif for headlines, a code-style font for labels. |

**Caching:** pages use Next.js's `"use cache"` with a few-minutes lifetime, so the database is read
at most once every few minutes no matter how many people visit. The brief changes once a day, so
readers never notice.

**Local mode:** with no database settings, or with `READ_LOCAL_DATA=1`, the site reads the
pipeline's JSON files, so it works on a laptop with nothing else set up.

### 8.2 Pages

| Page | What it shows |
| --- | --- |
| `/` | Homepage: sign-up, sources strip, today's top stories, company blogs strip |
| `/today` | Today's brief: Story of the day, then #2–#10 in importance order |
| `/feed`, `/feed/[topic]` | The full 30-story feed, and by topic (side menu on desktop, bottom bar on phones) |
| `/feed/top` | Top articles from Hacker News |
| `/companies` | Company blogs, with subject and company filters and a logo strip |
| `/brief`, `/brief/[date]` | The archive and any past day |
| `/brief/customize` | "Make it yours" builder with a live email preview |
| `/story/[key]` | One story: photo, all sources, timeline, share, **Listen** (reads this story aloud) |
| `/search` | Search across all stories and company posts |
| `/saved` | Saved stories (in this browser, or synced when signed in) |
| `/sources`, `/how-it-works` | The source list and how it works |
| `/blog`, `/guides`, `/newsletters`, `/compare` | Articles, guides, newsletter reviews |
| `/confirm`, `/unsubscribe`, `/preferences` | Links from emails |
| `/account`, `/signin` | Sign-in (when switched on) |
| `/contact`, `/privacy`, `/terms` | Contact and legal |
| `/rss.xml`, `/sitemap.xml`, `/robots.txt` | For feed readers and search engines |

**Navigation:** the top menu (Today, Feed, Company blogs, Archive, How it works) shows the page you're
on in bold with an orange underline, including sub-pages (a topic page highlights Feed).

**Design:** light by default with a light/dark/system toggle; every story card shows its topic,
time, number of sources and source logos; missing photos become designed topic cards.

---

## 9. Email

### 9.1 Sign-up (double opt-in)

1. A reader enters their email on the site → a row is created as `pending` with a random secret token.
2. A **confirmation email** is sent with a link to `/confirm?token=…`.
3. Clicking it makes them `active`. If today's brief has already gone out, it is **sent immediately**
   (and logged, so the morning run never sends it twice).

*Why double opt-in:* it proves the address belongs to the person, keeps spam complaints near zero
and protects our sending reputation.

### 9.2 The daily send — `kernel/send.py`

- Every active reader gets **their own** email: their topics, 5/10/15 stories, and format
  (summaries, headlines only, or with photos), plus the company read unless they turned it off.
- **Weekly readers** get a Sunday digest of the week's best stories, one per ongoing story.
- Every send is **logged** in `email_sends`, so re-running only reaches people who were missed.
- Sending is paced at 20 a minute (`SEND_PER_MINUTE`).
- Every email has a **manage link** (`/preferences?token=…`) and **one-click unsubscribe** headers
  (`List-Unsubscribe`, RFC 8058) so Gmail and Outlook show their own Unsubscribe button.

### 9.3 Delivery

| | |
| --- | --- |
| **Service** | Resend (`EMAIL_TRANSPORT=resend`), region Tokyo |
| **From** | `ReadKernel <brief@readkernel.in>` |
| **Replies go to** | `readkernel.brief@gmail.com` (`EMAIL_REPLY_TO`), because the domain address has no inbox |
| **Domain proof** | SPF, DKIM and MX records for `send.readkernel.in`, added automatically by Resend's Vercel integration |
| **Fallback** | Gmail SMTP with an app password (`EMAIL_TRANSPORT=smtp`), kept in the settings |
| **Testing** | `EMAIL_TRANSPORT=preview` saves emails as files instead of sending |

*Why Resend over Gmail:* mail from our own domain looks professional, is trusted more by inbox
filters, and avoids Gmail's sending limits. *Why not Gmail as the "from" address:* Gmail mail sent by
a robot is more likely to land in spam.

---

## 10. Hosting, domain and the daily schedule

| Piece | Setup | Why |
| --- | --- | --- |
| **Vercel** | Project `readkernel`, root folder `web`, framework Next.js | Free; every `git push` to `main` rebuilds and publishes the site in about 2 minutes. |
| **Domain** | `readkernel.in`, bought on GoDaddy (₹1 first year, ~₹899/year after) | Our own name, and needed to send email from our own address. |
| **DNS** | Nameservers moved to Vercel (`ns1/ns2.vercel-dns.com`) | One place to manage the site and the email records. |
| **Redirects** | `www.readkernel.in` and `readkernel.vercel.app` → `readkernel.in` (308, permanent) | One address for readers and for Google. |
| **GitHub Actions** | [`.github/workflows/daily-brief.yml`](../.github/workflows/daily-brief.yml), cron `30 0 * * *` | Free scheduler: 00:30 UTC = **6:00 AM IST**. |

**The morning job, in order:**

1. Install Python packages (cached) and the embedding model (cached).
2. `python -m kernel.run`: build the brief.
3. `python -m kernel.company_blogs`: add new company posts (allowed to fail without stopping the rest).
4. `python -m kernel.send`: email daily readers.
5. On Sundays (India time): `python -m kernel.send --weekly`.
6. `python -m kernel.telegram`: post to Telegram (does nothing until a bot is set up).

The job can also be started by hand from GitHub → Actions → "Run workflow".

**Secrets** (API keys, passwords) are stored in GitHub's encrypted secrets and Vercel's environment
variables, never in the code.

---

## 11. Security and privacy

- **Database rules (RLS):** the public key can read only public tables. Subscribers, the email log
  and the summary cache can't be read by visitors at all.
- **Two keys:** the website's public "publishable" key can only read; the "secret" key that can write
  lives only in GitHub secrets, Vercel's server settings and local `.env` files.
- **Tokens:** each subscriber's link token is 24 random bytes, checked against a strict pattern before
  any lookup.
- **No address fishing:** the sign-up form answers the same way whether or not an email is already
  subscribed, so nobody can use it to find out who reads ReadKernel. A 10-minute cooldown stops it
  being used to flood someone's inbox.
- **Unsubscribe** works in one click, and as a POST request only, so link-scanning tools can't
  unsubscribe people by accident.
- **No localhost links:** if the site's address is ever misconfigured as `localhost`, emails use the
  address the reader actually signed up on.
- **AI safety:** article text is passed as data, never as instructions, and every AI answer is checked.
- **Saved stories** without sign-in stay in the reader's own browser; nothing is sent to us.

---

## 12. Testing

| Check | Command | Status |
| --- | --- | --- |
| Pipeline tests (43) | `cd pipeline && .venv/Scripts/python -m pytest -q` | all pass |
| Website types | `cd web && npx tsc --noEmit` | clean |
| Website lint | `cd web && npx eslint .` | clean |
| Website build | `cd web && npx next build` | builds |

The tests cover fetching and parsing, filtering, grouping, ranking, the summary cache, photos,
timelines, discussions, saving to the database (with a fake database), email rendering in all formats,
personal picks, the weekly digest, reply-to, the company read, and company blogs (address cleaning,
Hacker News filtering, no duplicates, categories, scoring). AI calls are replaced by fakes in tests,
so they're free and repeatable.

---

## 13. Costs and free-tier limits

| Service | Free allowance | Our use | Watch out for |
| --- | --- | --- | --- |
| Groq | Daily and per-minute token limits | A few dozen calls a day | Big first fills (like 30 days of company posts) take longer because of per-minute limits; the retry logic waits automatically. |
| Supabase | 500 MB database, pauses after 7 days with no activity | A few MB | The daily job keeps it active. |
| Vercel | Hobby plan | One small site | Hobby is for non-commercial use. |
| GitHub Actions | Free minutes on public repos; 2,000 min/month on private | ~5 min a day | |
| Resend | **3,000 emails/month, 100/day** | One per subscriber per day | **Past ~90 subscribers**, upgrade Resend or split sending. |
| Domain | — | ₹899/year from year two | Turn on auto-renew in GoDaddy. |

---

## 14. Settings reference

Pipeline settings go in `readkernel/.env` locally and in **GitHub secrets** for the daily job.
Website settings go in `web/.env.local` locally and in **Vercel → Environment Variables**.
Templates: [`.env.example`](../.env.example) and [`web/.env.example`](../web/.env.example).

| Setting | Used by | Value now | Meaning |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | pipeline | `groq` | `groq`, `claude`, `openai` or `none` |
| `GROQ_API_KEY` | pipeline | (secret) | Free key from console.groq.com |
| `GROQ_MODEL` | pipeline | `openai/gpt-oss-120b` | Model on Groq |
| `MAX_AGE_HOURS` | pipeline | 36 | How old an article may be |
| `STORIES_PER_BRIEF` / `FEED_SIZE` | pipeline | 10 / 30 | Brief and feed size |
| `EMBEDDINGS` | pipeline | `local` | `local` (bge-small) or `simple` (word overlap, no download) |
| `TIMEZONE` | both | `Asia/Kolkata` | Which day a brief belongs to |
| `SUPABASE_URL` | both | project URL | Database address |
| `SUPABASE_SECRET_KEY` | pipeline, website server | (secret) | Can write; server only |
| `SUPABASE_PUBLISHABLE_KEY` | website | (public) | Read-only |
| `SITE_URL` | both | `https://readkernel.in` | Used in every email link |
| `EMAIL_TRANSPORT` | both | `resend` | `preview`, `smtp` or `resend` |
| `EMAIL_FROM` | both | `ReadKernel <brief@readkernel.in>` | Sender |
| `EMAIL_REPLY_TO` | both | `readkernel.brief@gmail.com` | Where replies go |
| `RESEND_API_KEY` | both | (secret) | Resend sending key |
| `SMTP_HOST/PORT/USER/PASSWORD` | both | Gmail | Fallback sender |
| `SEND_PER_MINUTE` | pipeline | 20 | Email pacing |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | pipeline | not set | Telegram posting |
| `NEXT_PUBLIC_AUTH_ENABLED` | website | not set | `1` turns on Google sign-in |
| `NEXT_PUBLIC_CONTACT_EMAIL` | website | `readkernel.brief@gmail.com` | Shown on contact and privacy pages |
| `READ_LOCAL_DATA` | website | not set | `1` reads local JSON instead of the database |

---

## 15. Everyday tasks

| Task | How |
| --- | --- |
| Add a news source | Add a line to `pipeline/sources.yaml`, then run `python -m kernel.sources` to refresh the website's source list. |
| Add a company blog | Add a line to `pipeline/company_blogs.yaml`, check it with `python -m kernel.company_blogs --dry-run`, refresh logos with `--export-web`. |
| Build a brief by hand | `cd pipeline && .venv/Scripts/python -m kernel.run` |
| Send yourself a test email | `python -m kernel.send --to you@example.com` |
| See who would get the email | `python -m kernel.send --dry-run` |
| Run the website locally | `cd web && npm run dev` (or `npm run dev -- --port 3200`) |
| Change the database | Write `db/migrations/006_….sql`, run it in Supabase's SQL Editor **before** pushing code that needs it. |
| Publish website changes | `git add .`, `git commit -m "…"`, `git push`; Vercel rebuilds automatically. |
| Check the morning job | GitHub → Actions → the latest "daily-brief" run. |

---

## 16. Decisions and lessons from the build

In the order they happened (October 2026):

| What happened | What we did |
| --- | --- |
| Clean-room rebuild of Trace's ideas chosen | Wrote everything from scratch; no Trace files or prompts used. |
| `create-next-app` left a hidden `.git` inside `web/`, so GitHub showed an empty folder | Removed the inner `.git` and re-added the folder. |
| Vercel built the project as Python | Set Framework = Next.js and Root Directory = `web`. |
| Next.js 16 rejected old-style caching settings | Switched to `"use cache"` + `cacheLife`, wrapped URL-reading pages in `Suspense`. |
| Groq retired Llama 3.3 70B | Moved to `openai/gpt-oss-120b`; added the word "json" every prompt needs. |
| AI wrote "2024" into a story; politics ranked high | Strict "facts from snippets only" prompt with today's date; editor rates politics 1–2. |
| A friend's confirmation link pointed at `localhost` | Emails now fall back to the address the reader signed up on. |
| Domain connected; home internet kept the old GoDaddy address | Waited for DNS caches; nameservers on Vercel. |
| Story of the day had no photo (publisher blocked us) | Try up to 3 outlets; designed fallback card. |
| Email moved from Gmail to Resend on our domain | Added `EMAIL_REPLY_TO` so replies reach Gmail. |
| Company blogs added | 30 companies, Hacker News for blogs with no feed, no duplicates, 7 subjects, depth rating. |
| Uber posts missing (country part in the address) | Addresses are cleaned before comparing. |
| Today's numbering jumped (topic groups) | Plain #1–#10 list; menu highlights the current page; Listen only on story pages; company logo strip. |

---

## 17. What's next

| Item | State |
| --- | --- |
| Chrome new-tab extension | Iteration 2 |
| MCP server (lets AI assistants read ReadKernel) | Iteration 2 |
| Google sign-in | Built; needs Google set up in Supabase and `NEXT_PUBLIC_AUTH_ENABLED=1` |
| Telegram channel | Built; needs a bot from @BotFather and two secrets |
| Delete the duplicate Vercel project `readkernel-5d84` | To do |
| GoDaddy auto-renew for readkernel.in | To do |
| Mobile app | Parked |
