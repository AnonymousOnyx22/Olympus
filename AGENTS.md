# Agent instructions

This repo is worked on by several agents at once (Claude Code, Codex, Kilo). Shared handoff lives in
[continue.md](continue.md).

- **When the user says "continue"**, read `continue.md` and resume from its **Next up** list without
  asking what to do.
- **Before you end a session**, update `continue.md`: move finished items into **Current state**,
  add anything new to **Next up**. Edit only the parts you changed - another agent may be updating
  it at the same time, so re-read it right before writing and never replace it wholesale.
- Re-read any file immediately before editing it. Never blanket-revert someone else's changes.
- Verify before claiming done: `cd lantern && npx tsc --noEmit -p . && npx vitest run && npm run build`.
