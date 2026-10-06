# Store build loop: results so far (2026-10-05)

Loop: build a store through Olympus's own New store flow with a fixed prompt, watch every phase, measure the
result, log each defect by cause (brief, code, model), fix the generator, rerun. Scope here is technical and
quality viability. **Nothing measured here is revenue**: no store has had a visitor or a sale.

## Iterations

| Run | Store | Brief version | Outcome |
|---|---|---|---|
| Wander Mug Co (earlier) | mugs, custom site | original | Stalled on a hung shell call; art from an image API had a watermark; folder emptied later |
| Harbor Desk | notebooks, custom site | + SVG art, detached launch | Completed (resumed headlessly after a restart); local test checkout only |
| 1 | sticker store | + adoption of discovered stores | Failed to start: race between my adoption code and New store. Fixed |
| 2 "Dogear" | sticker store | + quality, todo, honesty rules (partial) | Completed: 21/21 checkout tests, 33/33 purchase flow. Needed two interventions: hung launch call (released), model timeout (resumed) |
| 3 "Marginalia" | sticker store | + multi-page, humanised copy, honest-claims rules | Completed with no start failure. See measurements |

## Selection and pruning method

A build is kept only if it passes every row; each failure is logged with its cause and the generator is changed,
never the store. Pruned this session: image-API art (watermarks, 402s, crashes), custom Express servers that
cannot be hosted free, Shopify as the launch platform (needs a paid plan), marketplace dropshipping (disputes
and refunds land on the owner), per-store connection toggles, and fake social-proof badges.

## Marginalia measurements (live crawl, desktop 1440)

| Check | Dogear (before) | Marginalia (after) |
|---|---|---|
| Pages | 2 usable + blank shell | 12 reachable, 12 return 200 |
| HTTP errors / broken images | bundle image blank, bundle wrongly "sold out" | 0 / 0 |
| Em dashes in copy | present | 0 |
| Semicolons in copy | present | 0 |
| Fake badges or counts | "BEST SELLER", invented stock counts | none; copy states there are no sales yet |
| Animation | none | 7 keyframes, 24 transition rules, scroll reveals |
| Works without JavaScript | n/a | yes (2,444 characters of readable text) |
| Browser-tested desktop and phone | no | yes, by the agent, screenshots kept |
| Test purchase | passed | passed; 49 test orders created and cleared, honest report |
| Left a server running | yes (hung call) | no, port confirmed closed |

Judgement: distinct brand, consistent hand-drawn art, honest copy. Not template output.

## Defects found and fixed (cause)

1. New store never started: adoption raced launch (code, fixed)
2. Delete left folders and hid the error (code, fixed)
3. Model timeout ended the agent and nothing restarted it (code, fixed for the lead)
4. Agent never updated its todo list (brief, fixed)
5. Fake badges, duplicated copy, two-page sites, no motion (brief, fixed; verified on Marginalia)
6. Hung launch call despite a brief rule (brief ignored; needs enforcement in code, open)
7. Logo marquee on the site did not loop (site, fixed and measured)
8. Connections said "connected" without testing (code, fixed: real verification)
9. Stores had no supplier or host (brief and Connections, fixed on paper, unproven live)

## Still open

- Hung shell calls need code-level enforcement, not only a rule in the brief.
- Model timeouts hit specialists as well as the lead; recovery covers the lead only.
- Marginalia predates the STORE-LOG.md memory rule, so it has no log; the next run should.
- No live deploy, no live supplier order, no real visitor: the supply chain and hosting path is untested with real keys.
- Folder and store name still come from the prompt, not the brand.
