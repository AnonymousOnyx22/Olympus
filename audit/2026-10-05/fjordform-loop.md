# Fjordform growth loop

Owner's instruction (2026-10-06): keep running this loop until the site gets real traffic or becomes a working paid product (SaaS). Do not ask the owner questions. Decide, act, and record.

## Facts
- Store folder: `C:\Users\Nick\Downloads\Stores\build-me-a-muw576gx` (brand Fjordform, formerly PixelTrim).
- Live site: https://jolly-begonia-f52994.netlify.app (Netlify site id `5f7d5060-882a-4d11-814c-272405d15e3e`).
- The agent that builds it runs in Olympus (Station chat, Claude Sonnet 5.5 through the owner's own login). Olympus is started with a debug port, currently 9777 (it changes every relaunch: pick a free one and run sed on the scripts in %TEMP%\drive), so scripts in `%TEMP%\drive` can drive it (`fixchat.cjs` shows how to send a message). If the port is dead, relaunch Olympus from `lantern` with `--remote-debugging-port=<free port>` and repoint the scripts.
- The agent deploys itself (Netlify token reaches it through the bridge). Backup: Netlify connector `deploy-site`, then run the returned `npx @netlify/mcp` command in the folder.
- Report endpoint: `/.netlify/functions/report` with the token in `REPORT-TOKEN.txt` (also copied to `%TEMP%\px-token.txt`). Never print it or publish it.
- Audit scripts: `%TEMP%\seo_audit.py` (every sitemap page: title, description, h1, canonical, JSON-LD, dashes, hyphens, sliders) and `%TEMP%\drive\usability.cjs` (first-time visitor test, desktop and phone).

- Format roadmap: `audit/2026-10-05/fjordform-format-roadmap.md` (copied into the store folder as ROADMAP.md, which is never published). After the current job, step 3 of every iteration takes the next wave from that file (one wave per job, deploy and verify each time) instead of ad hoc pages. Owner asked on 2026-10-07 for every format a browser can honestly convert, including ipynb to PDF.

## The owner's checklist (judge the live site against every line)
1. No em dashes, en dashes or hyphens in visible copy, titles or descriptions (page addresses may keep hyphens).
2. Drop and done: no quality slider, always maximum quality, converts automatically on drop, two steps to a downloaded file.
3. SEO: unique title of 60 characters or fewer, unique description of 120 to 158 characters, one h1, absolute canonical, true structured data, sitemap with lastmod, internal links, fast. Never promise a top Google spot.
4. Ease of use score (judge every iteration): steps to a downloaded file (target 2), controls visible before the first conversion (target 2: From and To), time to result, phone layout without sideways scroll, plain error messages, keyboard use, labels.

## One iteration
0. At the start of every iteration, if no Monitor is armed, arm one that fires when the agent finishes (a new `done` line in `%TEMP%\bridge-app.log`), when the Olympus debug port dies, or when the battery drops to 10 percent. The half hourly cron alone misses events (it missed a finish on 2026-10-07).
1. Check the agent. Is a run in progress? (`%TEMP%\bridge-app.log` ends with `done` when idle, or look at the Station chat status.) If it is working, do nothing except report briefly.
2. Audit the live site with both scripts and the report endpoint. Record the scores in the table below.
3. Find the single biggest gap against the checklist, or if the checklist is met, the best next growth action (a new long tail page people really search for, better copy on the weakest page, IndexNow ping, free directory and tool listing texts for the owner to post, a related tool).
4. Send the agent one focused brief through Olympus (never more than one job at a time), telling it to deploy itself and verify live.
5. Update the log below and commit and push this file.

## If the laptop dies and comes back (written 2026-10-07 while the battery was at 13 percent)
1. Relaunch Olympus from `lantern` with `--remote-debugging-port=<free port>` and `OLYMPUS_BRIDGE_LOG=%TEMP%\bridge-app.log`, then repoint the scripts in `%TEMP%\drive`.
2. Open the Fjordform card in Station. The chat may show the last request with no answer: send a short continue message that says not to start over.
3. Job 3 (Merge PDF and Split PDF) may be unfinished: check the folder for the two tool pages and the live site, then finish deploy and verification.
4. Then send the saved wave 1 brief: `audit/2026-10-05/fjordform-wave1-brief.txt` (documents and notebooks, ipynb to PDF first).
5. The session cron and monitors die with the session. Recreate the cron from the 'One iteration' section if the Claude session was lost.

## Stop conditions
- Real traffic: the report shows at least 50 views in a day on tool pages that did not come from test visits (the test baseline is below), or Search Console access is given and shows impressions and clicks. Then report the numbers and keep improving what draws the traffic.
- Working paid product: an account plus payment flow that completes end to end in Stripe test mode with a test key the owner provides. The saved Stripe key is LIVE, so never call Stripe with it. Until a test key exists, this stays a plan: Fjordform Pro (bulk batches and no ads) as a candidate, built only after traffic proves demand.

## Honest limits
- A new site on a free subdomain with no links to it takes weeks to rank. Nobody can promise a top spot or overnight traffic.
- Real revenue cannot be proven without real visitors and a real buyer.

## Baseline (test traffic, not real)
- NOTE for every audit: test with the default headless browser identity, which the counter ignores. Runs with a normal Chrome identity added 10 test views on 2026-10-07 (report total 34, real traffic still 0).
- Report total at loop start (2026-10-06, all of it test visits by the agents and me, none real): REPORT TOTAL 24 pages 9

## Log
| When | Ease score notes | Biggest gap | Action sent | Result |
| --- | --- | --- | --- | --- |
| 2026-10-06 17:50 | 3 steps to download, 4 option tabs, quality slider at 90, Unavailable label, 45 hyphens, 1 en dash, half the descriptions under 120 characters | Ease of use and copy rules | Fix brief: remove slider and tabs, auto convert, copy rules, SEO text, IndexNow, deploy and verify | Pending |
| 2026-10-07 13:20 | MEASURED LIVE. Actions to a downloaded file: 2 (drop, Download) on desktop and phone. Controls before first conversion: 2 pickers (From, To) and a swap button, 0 sliders, 0 tabs. Time to result: 0.1 s for a 320 by 240 PNG, 0.9 s for a 4032 by 3024 photo to PNG (10.2 MB lossless). Outputs valid by file signature. Bad file gives one plain sentence. Skip link and logical Tab order. No sideways scroll. Drop zone about 260 px tall inside the first screen at 1280 by 720 and 375 by 740. Slow phone profile: LCP 1.45 to 1.7 s, CLS 0 to 0.005, 27 KB JavaScript, 14 requests. Copy and SEO across all 37 pages: 0 em or en dashes, 0 hyphens, 0 semicolons, every title 60 or fewer, every description 120 to 158, one h1, absolute canonical, valid JSON LD, alt text everywhere, lastmod on 37 of 37. | Checklist met. Small nits: a white background notice shows before any file is dropped, two phone icon buttons are 36 by 44 px. Growth is the real gap: report shows 34 views, all test visits, so real traffic is 0 | Brief 2: fix both nits, add 12 more conversion pages (HEIC to PDF, TIFF to PNG, BMP to PNG, ICO to PNG, SVG to JPG, SVG to WebP, GIF to JPG, GIF to WebP, WebP to GIF, PNG to GIF, AVIF to WebP, PDF to WebP), deploy, submit to IndexNow, test with the default headless identity so the counter ignores tests | Pending |
| 2026-10-07 13:30 | No new live audit: the live site is unchanged since the last measured pass (the 12 new pages are 404 live). Ease score stays 2 actions, 2 pickers, 0 sliders, 0.9 s for a 12 MP photo. Report: REPORT TOTAL 35 | top: / 17, /about/ 4, /tools/ 4, /faq/ 2 (34 at the last audit, nothing visits except tests, so real traffic is still 0). Battery 22 percent and on battery | Olympus had died (laptop unplugged, battery draining), killing the agent mid job | Relaunched Olympus (debug port 9777) and sent a short continue job: finish the polish fixes, test the 12 new pages, deploy with the Netlify CLI, IndexNow, verify live with the default headless identity | Pending |
| 2026-10-07 13:55 | MEASURED LIVE after the 12 page job. 49 of 49 sitemap pages return 200 with lastmod on all 49. Titles all 60 or fewer, descriptions all 120 to 158, one h1 on every page, absolute canonical and valid JSON LD everywhere, 0 em or en dashes, 0 hyphens, 0 semicolons, 0 images without alt. Private paths (token file, notes, build script, package.json, netlify.toml, .git, .env, tests) all 404. Report 401 without a token and 200 with it. Home page still 0 sliders, 0 file inputs hidden, drop and Download in 2 steps. Agent reports 2 tap target problems fixed, all 12 new pages convert real fixtures with correct signatures. Report total 36, all test visits, real traffic 0 | Checklist met. Growth gap: no links to the site and nothing indexed yet. High volume tools still missing | I missed that the agent finished at 13:43 because only the half hourly check was watching. Added a live Monitor for finish, Olympus down and battery under 10 percent. Sent job 3: Merge PDF and Split PDF tools, vendored pdf-lib, deploy, IndexNow, verify live | Pending |
