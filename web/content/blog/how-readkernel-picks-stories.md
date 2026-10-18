---
title: How ReadKernel picks the day's ten stories
description: From about 3,000 articles to ten stories in one morning run, and why each step exists.
date: 2026-10-18
---

Every morning at 6 AM India time, ReadKernel reads about 3,000 articles from more than 50 sources and turns them into ten stories. Here is what happens in between, step by step.

## 1. Read only what's new and real

We fetch every source's feed in parallel and keep articles from the last 36 hours. Anything that is clearly a shopping deal, a coupon, a gift guide or a "how to watch" post is dropped by keyword. If two sources send the same link (or the same headline), we keep one copy, preferring the source we trust more.

That usually leaves 200 to 300 articles.

## 2. Merge coverage of the same event

When OpenAI ships a model, ten outlets write about it. You should read about it once.

Each article is turned into a list of numbers that captures its meaning (an *embedding*), using a small open model that runs on our own machine for free. Articles whose meanings are nearly identical are merged into one story straight away. Pairs that are close but not certain go to an AI editor, which answers one question: *is this the same real-world event, or just a related one?* A follow-up, a reaction piece or a different deal by the same company stays separate.

## 3. Rank by what actually matters

A story's starting score comes from three things:

- **Coverage**: more independent sources means a bigger story (counted on a log scale, so two sources versus four matters more than ten versus twelve).
- **Trust**: the best source covering it. A company's own announcement or a careful outlet counts for more.
- **Freshness**: newer stories score higher, fading by half every 12 hours.

Then the AI editor rates the top 30 stories from 1 to 5 for how much they matter to people who work in tech. Politics and celebrity news score low unless they are directly about technology.

## 4. Keep it varied

No more than three stories from one topic make the brief, so a busy gadget day can't crowd out a big security breach. The best 30 stories become the [feed](/feed); the top ten become the [brief](/today).

## 5. Explain each story, from the sources only

For each story, the AI writes a plain headline, two or three sentences of facts, and one line on why it matters. It may only use what the source articles say: no years, names or background from its own memory, because that memory can be out of date. Every story links to every article it came from, so you can check.

## 6. Deliver

The brief lands in your inbox, on [the website](/today) and in our RSS feed. If you've [made it yours](/brief/customize), your email follows your topics, length and format.

The whole run takes about three minutes and costs nothing: the AI runs on a free tier, and the matching model runs locally.
