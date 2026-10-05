# continue.md

Shared handoff for every agent on this repo (Claude Code, Codex, Kilo). When Nick says
**"continue"**, read this file, pick up at **Next up**, and keep going without re-asking. Before
ending a session, update only the sections you changed - another agent may be editing it too.

## The goal

Olympus Station must build and run **autonomous, 24/7-managed stores** with no human babysitting:
simple, sellable ideas (stickers, POD mugs/apparel, digital downloads, narrow dropshipping), built
to a genuinely working state in one pass, then watched and improved continuously - dropping what
isn't working, doubling down on what is.

## How Nick works

- Often away: **don't ask questions when he's said he's leaving** - make the call and keep going.
- **Codex and Kilo edit this repo at the same time.** Re-read a file right before editing it, never
  blanket-revert, and expect "changed on disk" notices. `stationBrief.ts` is the hottest file.
- Audit means report, not take over: don't generate assets or edit files inside a store folder
  unless asked. Fix the generator (brief/code), not each generated store.
- Site is **waitlist-only** - no pricing, licence, or refund promises.

## Current state (2026-10-04)

**Stores** (`C:\Users\Nick\Downloads\Stores\`)
- `build-a-small-online-murqxud7` - Wander Mug Co. In production. Its agent reported **live**
  Stripe keys (`sk_live_`/`pk_live_`) in Connections - Nick needs to swap to `sk_test_` until launch.
- `harbor-desk-muucj959` - Harbor Desk. **Complete**: 5 SVG products + PNGs, logo, storefront,
  shipping page, local test-mode checkout, self-verified end to end. Idle - needs Manage 24/7 on.
- `harbor-desk-muuc6yoz` - abandoned first Harbor Desk attempt, empty. Safe to delete.

**Shipped this session (Station reliability)**
- Brief: hand-written SVG art only (never an image API or stock photo; always render a PNG copy
  for Olympus's cover art); simple-commodity platform bias (POD/Gumroad over a custom backend);
  open-ended requests default to simple unattended-friendly products; 24/7 pass judges real
  performance signal and pivots/doubles down; abandoned delegated tasks get redone, not waited on.
- `projects.ts`: `listStores()` auto-discovers any folder in a Stores root (not just ones made via
  "New store"); `findProject()` resolves discovered stores to their own real-cased folder (was
  silently falling back to the General folder); `removeStore()` can delete discovered stores.
- `spacePool.ts`: stores are never evicted by the 4-daemon cap, independent of renderer pinning.
- `App.tsx`: discovered stores adopt their existing session instead of "Manager setup unfinished";
  new stores start with Manage 24/7 on (first check after one interval).
- StoreCard: standing-by dot is neutral grey (blue read as "working"); a specialist task running >30 min shows an amber stalled dot.
- Connections: 79 providers, browser sign-in (not for payment processors), every saved connection
  available to every store automatically (no per-store toggle).

## Next up

1. Confirm in the running app that Harbor Desk shows as a live card and Manage 24/7 check-ins fire.
2. Run a **fresh test store** using the **Store fine-tuning run** procedure below, start to finish.
3. Website audit still open: `site.config.json` has TODO legal name/emails (build gate correctly
   refuses until filled). `electron/license.ts` is unwired scaffolding - fine for now.
4. 47 pre-existing React lint warnings (setState-in-effect etc.) - not bugs, low priority.

## Store fine-tuning run

The loop that makes Station one-shot stores: build one, watch every step, log what it gets wrong,
fix the **generator** (brief or code), rerun the same prompt. Never hand-fix the store itself - a
fix that only lives in one store folder teaches the next build nothing.

**1. Start clean.** Launch Olympus the safe way (see below). Delete abandoned test stores first so
they don't get confused with the new one.

**2. Create the store through Olympus's own New store flow**, not the CLI - only that path
registers it, starts 24/7 management, and runs the real brief. Use a simple, sellable idea and keep
the prompt fixed between runs so results are comparable. Standard prompt:

> Build a small online store selling 6 die-cut vinyl stickers with a cozy reading theme. Hand-draw
> the logo and every sticker design. Set up a real, working checkout in test mode using whichever
> payment connection is configured. If a marketplace or social sign-in is available, use it for
> real; otherwise build it as a standalone storefront. Before telling me it's done, go through the
> full purchase flow yourself in test mode and confirm it completes.

**3. Find the session and arm a monitor.** Get the new folder from `Stores\` and its session id
from the DB (`session` where `directory` matches, `parent_id` null). Poll every 15 s; emit a line
only when the latest part's type/tool/status/command, the file count, or the subagent list
changes; emit on any `"status":"error"`; stop after `completed:true` holds for 2 polls. Keep ages
and timestamps **out** of the change signature.

**4. Check each phase as it happens** - log a finding the moment one fails:

| Phase | Pass looks like | Red flags |
|---|---|---|
| Setup | Works directly in the assigned folder; real brand name; honest folder name | Nested project folder; folder named after the prompt; invented Unix aliases on Windows |
| Plan | Delegates real, scoped subagents (research, art, copy, build, verify) | Fake specialist tasks; doing everything serially with no plan |
| Art | Hand-written `.svg` per product + logo, each with a `.png` copy; `logo.png` in the store root | Any `curl` to an image API; Python image scripts; stock downloads; model-probe scripts. **Open the PNGs** and look: on-brief, no watermark, not placeholder shapes |
| Copy | Real product names, prices, descriptions matching the brand; consistent voice | Lorem ipsum, TODOs, prices that disagree between pages |
| Storefront | Every route returns 200; every `<img src>` resolves (extract and curl them all) | 404 images, dead links, stub pages behind nav |
| Checkout | Test mode only; a test order completes to a confirmation | Connections holds `sk_live_`/`pk_live_` keys; checkout faked with no order record |
| Verification | Agent launches the server **detached**, verifies in a separate call, completes a test purchase itself | A tool call stuck "running" past its timeout; claiming done without testing |
| Report | Final summary matches what is actually on disk | Claims of listings, connections, or live status that aren't true |
| 24/7 | Manage 24/7 is on; first check-in fires after one interval and reports tested / fixed / improved / keep-or-drop with evidence | No check-in; a check-in that only reads files; same "improvement" repeated |

**5. Treat a stall as a finding, not a wait.** No new part for 3+ minutes while not completed:
- Last part is a `bash` tool still `running` -> hung shell (usually a server started in the
  foreground or via `Start-Process`); check its child processes.
- A subagent session stopped updating while the parent waits -> orphaned task (often a restart).
- Nothing running and no error -> likely a permission prompt; check the Olympus window.
Recover with `opencode run --session ... --auto` (below), and log the root cause either way.

**6. Log every defect** in `audit/<date>/findings.md`: what happened, which phase, evidence (file,
command, screenshot), and the cause - **brief** (instructions missing or contradictory), **code**
(Olympus did the wrong thing), or **model** (instructions were clear and it still failed).

**7. Fix, test, rerun.** Brief issues go in `lantern/src/services/stationBrief.ts` with an assertion
in `tests/stationBrief.test.ts`; code issues get a regression test. Run the verify command, push,
then **rerun step 2 with the same prompt** and confirm the defect is gone. Done when a fresh store
passes every row of the table with zero intervention - then try a different product type.

**8. Update this file**: move fixed items to **Current state**, add new ones to **Next up**.

## How to resume monitoring

- **Never launch Electron from Claude Code's shell as-is**: it has `ELECTRON_RUN_AS_NODE=1`, which
  makes Electron run as plain Node and crash (`electron.app` undefined). Use:
  `cd lantern && env -u ELECTRON_RUN_AS_NODE npm run dev` (run in background).
- An agent-launched Olympus is killed when the shell's background time limit runs out (about 30 min
  by default, 2 h max). Fine for a test run; for real 24/7 management Nick must launch Olympus himself.
- Session/activity lives in opencode's DB: `%USERPROFILE%\.local\share\opencode\opencode.db`
  (read-only via `node:sqlite`). Tables `session` (id, parent_id, title, directory, time_updated),
  `message` and `part` (JSON in `data`; `role`, `tool`, `state.status` are inside the JSON).
- Resume a dead session directly, bypassing the UI:
  `opencode run --session <id> --dir "<store folder>" --model opencode/big-pickle --auto "<prompt>"`
- Monitor signatures must exclude ages/timestamps or they fire every poll.

## Verify before you claim done

`cd lantern && npx tsc --noEmit -p . && npx vitest run && npm run build` - last run: 163 passing.
