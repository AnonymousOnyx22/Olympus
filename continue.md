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
- Connections: 79 providers, browser sign-in (not for payment processors), every saved connection
  available to every store automatically (no per-store toggle).

## Next up

1. Confirm in the running app that Harbor Desk shows as a live card and Manage 24/7 check-ins fire.
2. Run a **fresh test store through Olympus's own New store flow** and watch it end to end; note
   anything it gets wrong (art, design, checkout, stalls) and fix the brief/code, then rerun.
3. Surface a dead/orphaned subagent task in the UI - today a task killed by a restart shows
   "running" forever (cosmetic, but misleading). Detect stale running tool parts and mark them.
4. The blue "Standing by" dot reads as "working" to Nick - consider a neutral idle colour.
5. Website audit still open: `site.config.json` has TODO legal name/emails (build gate correctly
   refuses until filled). `electron/license.ts` is unwired scaffolding - fine for now.
6. 47 pre-existing React lint warnings (setState-in-effect etc.) - not bugs, low priority.

## How to resume monitoring

- **Never launch Electron from Claude Code's shell as-is**: it has `ELECTRON_RUN_AS_NODE=1`, which
  makes Electron run as plain Node and crash (`electron.app` undefined). Use:
  `cd lantern && env -u ELECTRON_RUN_AS_NODE npm run dev` (run in background).
- Session/activity lives in opencode's DB: `%USERPROFILE%\.local\share\opencode\opencode.db`
  (read-only via `node:sqlite`). Tables `session` (id, parent_id, title, directory, time_updated),
  `message` and `part` (JSON in `data`; `role`, `tool`, `state.status` are inside the JSON).
- Resume a dead session directly, bypassing the UI:
  `opencode run --session <id> --dir "<store folder>" --model opencode/big-pickle --auto "<prompt>"`
- Monitor signatures must exclude ages/timestamps or they fire every poll.

## Verify before you claim done

`cd lantern && npx tsc --noEmit -p . && npx vitest run && npm run build` - last run: 163 passing.
