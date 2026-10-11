# Agent instructions

Kern is a desktop workspace that connects all your AI agents and models so you can work on separate
projects at the same time. It is not an agent itself. This repo holds the app (`app/`) and its
marketing site (`website/`). Several agents (Claude Code, Codex, Kilo) may edit it at once.

- Re-read any file immediately before editing it. Never blanket-revert someone else's changes.
- Verify the app before claiming done: `cd app && npx tsc --noEmit -p . && npx vitest run && npm run lint && npm run build`.
- The website's pages are generated: edit `website/build.mjs`, then run `node build.mjs` in `website/`.
  Preview with `cd website && npx --yes serve .`.
- Do not launch Electron from a shell that has `ELECTRON_RUN_AS_NODE=1` (Claude Code's shell does):
  use `cd app && env -u ELECTRON_RUN_AS_NODE npm run dev`.
- No handoff file is kept. Put durable notes in `app/README.md`, `website/README.md` or the commit.
