# Store fine-tuning run - stickers (2026-10-05)

Prompt: standard sticker prompt from continue.md, via Olympus New store (isolated profile).

## Defects
1. **[code, FIXED] New store never started - "That project could not start."** My session-adoption
   effect opened the new store's daemon at the same moment launchStation did; the second start
   cancels the first. Fix: launchStation marks the store handled before it enters the list.
2. **[code, open] Folder/store name comes from the prompt, not the brand.** Blank name gives
   `build-a-small-<id>` and the sidebar shows "Build A Small Online" although the agent chose
   "Dogear". The agent can't rename its own folder; Olympus should adopt the brand name it picks.
3. **[harness, FIXED] Observer attached to the wrong store** (picked an existing session).

## Observations (pass)
- Setup: secrets checked by name only; no image API calls; brand chosen by the agent.
- Plan: real delegation (art, copy) with scoped tasks.
- Art: SVG + PNG per sticker via its own resvg pipeline. Note: agent says it cannot view images,
  so it verifies art programmatically only - on-brief quality needs a human/our eyes.
4. **[code, FIXED] Delete store "did nothing".** The folder's contents were deleted, but the folder
   stayed (running agent held it on Windows), the error was swallowed, and discovery listed the empty
   folder again as "setup unfinished". Now: retried delete, error surfaced, and a kept/stuck folder
   is hidden so it isn't rediscovered.
5. **[brief, FIXED] Agent never updates its todo list.** Plan stayed 1/11 while brand, deps, art and
   copy were done. Brief now requires keeping it current as steps finish.
6. **[brief ignored / code, open] Lead hung ~5 min on a launch call.** It ran `node scripts/launch.mjs; ...
   Invoke-WebRequest ... | tail -n 2` as ONE call with no timeout. Its own launcher left the dev server
   attached to the output pipe, so `tail` never returned. Broke two brief rules (explicit timeout;
   launch and verify in separate calls). Server was healthy the whole time. Recovered by stopping the
   server process (PID held the pipe). The brief is not enough: needs enforcement in code (a default
   shell timeout for Station sessions) or a stricter, top-of-brief rule. Same class as Wander Mug Co.
7. **[brief, open] Storefront honesty/design** - fake "BEST SELLER" badges and invented stock counts,
   bundle shown SOLD OUT with all items in stock + blank image on /shop, shipping/returns text duplicated
   in body and footer, 6 items in a 4-col grid. (Overall design is NOT template slop: cohesive palette,
   serif type, consistent hand-drawn art, specific copy.)
8. **[code, open] Folder/store name comes from the prompt, not the brand** (`build-a-small-...`).
9. **[brief, FIXED] Todo list never updated** (plan stuck 1/11).
10. **[code, FIXED] Model timeout killed the agent.** Lead and frontend specialist ended on
    `UnknownError: The operation timed out.` and nothing restarted them. Olympus now resumes a store
    whose last message errored (checked every 30s, 45s apart, max 5 tries). Recovered this run by hand.
11. **[site, FIXED] Logo marquee didn't loop.** `.providers__row` still had `display:flex;
    justify-content:center`, centering a 3312px track in a 1160px box: loop started ~1000px off and the
    right side went blank each cycle. Now `display:block`; measured full at 1440/1920/2560.
12. **[brief, FIXED] Storefront quality** - added rules: humanized copy (no em dashes/semicolons/stock
    phrases), real multi-page site, animation and interactivity, loop testing, no fake social proof,
    no duplicated content, bundle availability, view in a real browser before done.
Result: Dogear finished - 21/21 checkout tests, 33/33 purchase flow, server launched detached.

## PixelTrim audit (2026-10-06, live https://jolly-begonia-f52994.netlify.app)

Real: live, 14 pages return 200, 9 tool pages with file inputs, sitemap and robots and IndexNow key resolve.
Defects found (agent reported STORE COMPLETE anyway):
1. visitor-count function returns Math.random numbers, report falls back to mock data: fabricated traffic. Cause: model could not get Blobs working and faked it.
2. sitemap, robots and IndexNow use https://pixeltrim.tools, a domain nobody owns. Canonical tags are relative.
3. Semicolons in copy.
4. Default report token.
Lesson: a model under pressure invents data to look finished. Playbook now says never invent a number; the watchdog now requires a fresh STORE COMPLETE after a fix pass. Reopened with a fix prompt.
