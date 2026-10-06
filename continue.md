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
- Connections verify for real: saving a key tests it against the service (Stripe incl. test/LIVE mode and
  mismatched pairs, Printful, Printify, Netlify, Vercel, Cloudflare, Render, Shopify incl. plan that cannot sell,
  Gumroad, SendGrid, Discord, Mailchimp). Result is stored with the values and dropped when they change; services
  with no check say "Saved, no test", never "verified". Browser sessions still cannot be verified. Next: more
  providers' checks (Resend, Canva, R2/S3 need signed requests), and surface a failed check to the store agent.
- Connections: 79 providers, browser sign-in (not for payment processors), every saved connection
  available to every store automatically (no per-store toggle).

**Visual and copy review (2026-10-05)**
- Olympus website has a recognizable illustrated Greek visual system; the strongest "AI slop" risk is
  vague/repeated benefit copy, not a generic visual template. Nick clarified that Olympus does not
  cater to mobile; keep visual review and improvements focused on desktop.
- Station's generic blue controls, blank/placeholder store cover, small metrics, and ambiguous
  "Managing 24/7"/"steps done" labels weaken trust. A 24/7 label only means checks while Olympus is open.
- Dogear had fake best-seller/stock claims and broken/blank product images; Marginalia is substantially
  more distinct, but storefront copy must not claim human hand drawing, packing, shipping, or proven
  sales until those things are true. No store has yet had a real visitor or sale.

**Business model breadth (2026-10-05)**
- Codex extended `storeModels.ts` from eight to twelve routes: original reports/data, paid alerts,
  lead generation, and niche job boards were added. Newsletter copy no longer assumes Nick sells
  sponsor slots. `STORE-PLAN.md` now points to `audit/2026-10-05/business-model-review.md`, which
  sets the revenue and unattended-operation gates for each model. Claude is running the real builds.
- Verification after this edit: TypeScript passed; Vitest 198 passed, 1 skipped; build passed.

## Next up

1. Confirm in the running app that Harbor Desk shows as a live card and Manage 24/7 check-ins fire.
2. Run a **fresh test store** using the **Store fine-tuning run** procedure below, start to finish.
3. **Adopting discovered stores starts an agent for every one of them at launch** and stores are
   exempt from the 4-agent cap, so N stores means N agents forever, and a killed one is restarted by the
   reopen effect (this is what kept two deleted stores' folders locked). Adopt lazily (when a store is
   opened) and make the app's own delete clear the renderer state.
4. **Model timeouts are frequent** ("The operation timed out" hit the lead, the frontend specialist and
   a drawing specialist in one build). Auto-resume covers the lead only; cover specialists and look at
   the model/provider timeout.
5. **Enforce shell timeouts in code**, not only in the brief (Dogear's lead hung 5 min on one launch call).
6. **Store folder/name comes from the prompt, not the brand.**
7. Run the fine-tuning procedure on Marginalia (run 3, started 2026-10-05) and judge the result against
   the new storefront rules; see audit/2026-10-05/findings.md for run 1-2.
8. Brief now has evidence-based idea selection, STORE-LOG.md memory, and an idea/testing pipeline in the
   24/7 pass. Unproven in practice: watch a real check-in and see that it keeps the log and adds a product.
9. **Supply chain and hosting are not proven end to end.** Stores had no supplier and nowhere to live (only
   art + a local test checkout). Brief now requires a POD supplier (Printful/Printify/Gelato) with real costs
   and margin, print-ready PNGs on a media host, order webhook -> supplier order, and a deploy via a hosting
   connection (Netlify/Vercel/Cloudflare Pages/Render, just added to Connections). Needs a live test with
   real keys: owner must add supplier + hosting + live Stripe; agents cannot create those accounts.
10. Website audit still open: `site.config.json` has TODO legal name/emails (build gate correctly
   refuses until filled). `electron/license.ts` is unwired scaffolding - fine for now.
11. 47 pre-existing React lint warnings (setState-in-effect etc.) - not bugs, low priority.
12. Use the desktop visual/copy review to tighten launch surfaces: make Station status and
    next-action labels evidence based; require generator copy to describe the actual art method,
    supplier, shipping, and observed performance honestly.
13. Test a **different revenue mechanism** after the current digital-download run: prefer an original
    paid report/data product, then a paid utility or alerts. Do not call an audience route monetized
    until the buyer, subscribers, or advertiser agreement exists; use the acceptance gates in
    `audit/2026-10-05/business-model-review.md`.

14. **Live builds (2026-10-06).** Chalkline (`build-me-a-muw0k7fb`: Excel and PDF workbooks for HVAC
    contractors, Swiss grid, Netlify + Stripe) was resumed headlessly and is still producing product files; no
    storefront or deploy yet. A free-tools store (image converter and resizer, ad or sponsor slot, search
    playbook) was started on the real profile as `build-me-a-muw576gx` after rebuilding, so the 10 minute
    model timeout is live for it. Audit both with `audit/2026-10-05/audit-store.cjs`, log defects in
    `findings.md`, then run a newsletter build for comparison.
15. **Search playbook** (`searchPlaybook.ts`) is in the brief: long-tail phrases, one page per intent, tools run in
    the browser, IndexNow, honest link building, never promise a ranking. Unproven until a store ranks.
16. **Cleanup when fine-tuning ends:** delete the test and non-working stores (owner's instruction), keep what
    is genuinely launched. Not before: they are still being used for fine-tuning.
17. Free hosted models were compared on a tiny tool task (nemotron-3-ultra-free, longcat-2.5-preview-free,
    big-pickle): all passed in about 20s, so big-pickle stays. A local model is not viable on this laptop
    (integrated Arc graphics, 15.7 GB RAM).

18. **GOAL (owner, 2026-10-06): a working store that gets search traffic, starting with the free image converter
    and resizer site.** Claude and Codex both work on it. Honest target: a new domain cannot rank overnight, so
    "overnight" means everything that makes ranking possible is live and checked by morning: live URL, one
    page per search phrase with a working in-browser tool, sitemap and robots, IndexNow submitted, structured
    data, Lighthouse and phone checks passed, search log started in STORE-LOG.md. Real traffic is judged in
    weeks and only from Search Console or analytics numbers, never guessed. `audit/2026-10-05/watchdog.cjs`
    restarts a quiet store agent (and falls back through free models when opencode's free tier limit is hit or a model stops answering: big-pickle, nemotron-3-ultra-free, longcat-2.5-preview-free, mimo-v2.6-flash-free, fledge-alpha-free, ling-3.1-flash-free), and both stores need the first-party visitor counter so the morning report has real numbers; it restarts a quiet store agent (log: `%TEMP%\watchdog.log`); it stops when the agent writes STORE COMPLETE.

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

**Active dual-build watch (Codex, 2026-10-05):** read `audit/2026-10-05/codex-dual-build-watch.md`.
Browser-tools agent printed live Stripe and Netlify credentials into its local transcript (values not
copied); Chalkline's workbook verifier can report PASS despite calculation errors. These findings
need attention during Claude's current runs.

**Overnight goal (Nick, 2026-10-06):** working public image converter with real organic search
visitors. Nick explicitly authorized autonomous work and a goal, and has left for the night.
Codex owns independent conversion/search-readiness tests, indexing research/submission, and traffic
measurement for `build-me-a-muw576gx`; Claude owns the active store build and runtime recovery.
Coordinate via this handoff and `audit/2026-10-05/codex-dual-build-watch.md`. Do not count our test
requests as visitors or promise overnight indexing. PixelTrim resumed at 04:03 UTC and is writing
its converter pages. Codex's `converter-functional-check.cjs` tested actual downloads: PNG-to-JPG
passes format/dimensions/white transparency background; HEIC input is rejected and native decoding
also fails. See `converter-functional-results.json` and `pixeltrim-search-notes.md` before launch.
Chalkline has both an external `opencode run` (PID 28420)
and app daemons active, with two overlapping assistant streams; investigate duplicate execution.

`cd lantern && npx tsc --noEmit -p . && npx vitest run && npm run build` - last run: 163 passing.
