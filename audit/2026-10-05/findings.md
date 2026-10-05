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
