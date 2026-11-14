# Ask check

A small, fixed set of questions for Ask ReadKernel (`/api/ask`), so a change
to the agent or its prompt can be judged by before-and-after answers, not by
trying a couple of chats.

```bash
# start the site; Ask needs OPENAI_API_KEY in web/.env (the web app doesn't read the root .env)
cd web && npm run dev

# in another terminal
node scripts/ask-check/run.mjs                      # against http://localhost:3000
node scripts/ask-check/run.mjs --base https://readkernel.in --only typed
node scripts/ask-check/run.mjs --case fireworks-startup-competitors   # one case
node scripts/ask-check/run.mjs --only scope        # only the stay-on-topic cases
```

Each run writes a report to `web/.ask-runs/<time>.md` (not committed): every
question, the answer, the tools it called, and automatic checks.

Story cases run two ways:

- **page**: the reader taps "Ask about this story" and asks the bare question
  (the story key is sent with it).
- **typed**: the old way: the reader opens `/ask` and types the story in.

`/api/ask` allows 12 questions per 10 minutes per visitor. A full run is 12, so
the script waits and retries if it hits the limit. It also waits and retries
when the AI is busy or out of quota ("Ask ReadKernel is resting"), since that
is not an answer to grade.

Scope cases check that Ask stays on tech and AI news: coding help, homework,
general knowledge, advice, "which AI are you" and attempts to talk it out of
its rules (including a faked earlier reply) must get the fixed decline, while
news questions that merely name Python or Copilot, short follow-ups and story
page questions must still be answered. The report's scope column marks each
one ok or **wrong**.

## Reading the report

The automatic checks catch the obvious failures (no answer, no links, too
long). Then read every answer against this checklist, and note each failure:

1. **Answers the question.** It addresses what was asked (rivals, the space,
   the timeline), not just a restatement of the story.
2. **Every fact is linked**, and the link is to a source from ReadKernel's
   coverage, not a made-up address.
3. **Nothing invented.** No company, number or date that the coverage doesn't
   support. Naming a rival from memory counts as a failure.
4. **Honest about gaps.** When the coverage is thin, it says so instead of
   stretching an unrelated story to fit.
5. **Readable.** A direct answer first, short, plain English.

Compare runs by counting failures per item. Keep a change only if it lowers
them without new failures elsewhere.
