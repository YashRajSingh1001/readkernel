# Agent instructions

Notes for AI coding agents (Claude Code, Cursor, Codex) working in this repository.
The web app has its own Next.js rules in [`web/AGENTS.md`](web/AGENTS.md); read those before changing anything under `web/`.

## Skills

### `/bro`

When the user types `/bro` (or "bro?"), restate your last message. Stop using jargon and speak coherently. State it more simply and concisely, like one human talking to another.

Only run this when the user asks for it. Don't add new information or redo any work: same content, plainer words.

_From [pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/bro) (MIT)._
