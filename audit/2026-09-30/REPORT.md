# Olympus visual and functional audit

Audit started 30 September 2026 and continued into 1 October (America/Toronto).

The website has a workable responsive foundation, but production-header behavior and the signup destination still prevent a dependable public experience. The desktop app starts and builds successfully; external links and embedded previews fail in runtime checks. A project-switch/save interaction needs urgent regression testing because its current design can target the wrong project.

## Scope and evidence

- Website: all 15 current HTML pages, including `app.html`, checked at 1440px and 390px; the original 14 pages also checked for overflow at 320px and 768px. Screenshots, local links, fragment targets, image loading, console exceptions, and automated WCAG A/AA checks were collected.
- Interactions: mobile menu opening/Escape, FAQ expansion, discovery panel/Escape, demo tab selection, and arrow-key tab navigation passed. Earlier transition checks covered delayed loading, back navigation, cached-page restoration, and JavaScript-disabled fallback.
- Deployment behavior: the configured Content Security Policy was applied by a local HTTP server. This exposed failures that ordinary local preview does not show.
- Desktop: compiled Electron build launched on Windows with a temporary Electron data directory and hidden window. Startup, project manager, minimum window size, external-link IPC, a local iframe, modal keyboard focus, and accessibility were inspected. Installed OpenCode reported version 1.18.33 and was available/supported.
- Build: `npm run build`, including typechecking, passed. Unit tests: **93 passed, 1 skipped, 7 test files passed**. Lint: **3 errors, 35 warnings**. Latest `site:check`: **failed on 10 required TODO values**.
- No purchases, signups, publishing, real-project edits, or model prompts were performed. No live payment or external inbox delivery was claimed as tested. macOS/Linux packaging, real device testing, screen-reader use, long-running multi-agent sessions, terminal execution, and actual edit approval remain outside this run.
- External web fonts were blocked in website automation to give a repeatable fallback-font baseline. Screenshots therefore do not certify remote font delivery or exact Google Font rendering.

The working copy changed during the audit: pricing/download language became a pre-release waitlist, and `app.html` was added. The priorities below follow the **current waitlist direction**. Earlier missing checkout/download findings are historical, not instructions to restore sales or downloads.

Evidence: [website results](website-results.json), [desktop results](desktop-results.json), [production-header results](production-results.json), and [screenshots](screenshots/). Audit scripts use the local Playwright/axe installations recorded in their source.

Final artwork verification: eight direct-reference `-v2` illustrations installed, with 1440px/720px WebP exports. Desktop/mobile screenshots confirmed full compositions and removed the hard mobile image edge. The final pricing pass caught the literal text `a set priceundefined`, which overflowed at 390px; it was replaced with `Not released`. Pricing still mixes older forty-nine-dollar/trial language with the current unannounced-price/waitlist direction; reconcile its visible copy and social metadata during stage 3. The discovery control was removed in the evolving working copy, so its earlier passing check is historical; the final script reports it as absent.

## Visual work completed during this session

These changes were already requested before the audit; other findings below are a plan, not a claim that they have been repaired.

- Replaced the vertical/fading page transition with left/right cloud motion. Navigation waits for every cloud layer to close; the destination opens after loading. Removed the body fade that made the curtain disappear.
- Reworked the closed curtain from horizontal bands into overlapping, irregular cloud contours with cream highlights, blue spiral shading, and offset layers. Added mobile sizing to avoid stretching round clouds into narrow vertical shapes.
- Moved curtain row positions into external CSS so production CSP does not discard their positioning.
- Added distinct architectural scenes in sparse sections, with responsive WebP variants and lazy loading.
- Fixed the missing sanctuary image used in the home-page ownership section.
- Replaced “Power that stays on your mountain” with “Your projects. Your choice of models.”
- Identified damaged low-resolution portrait sources: the Artemis image is 370×420, has its head cropped, and includes part of a second figure. Replaced affected banner imagery rather than trying to repair it with CSS enlargement.
- The first replacement set drifted into living fantasy characters and painterly imagery. The corrected `-v2` set uses the original Athena image as a **direct visual reference**, preserving ivory sculpture, navy contours, restrained gold, and Greek spiral clouds. Retired variants are retained as source artifacts but removed from active placements where replaced.

Prompts, tool provenance, and workspace asset filenames are in [ILLUSTRATIONS.md](../../olympus-web/assets/ILLUSTRATIONS.md). Images were generated with the built-in image-generation tool, then saved as optimized project assets.

## Findings and priority

**P0:** potential data integrity problem; validate before trusting editing workflows. **P1:** broken primary behavior or public-launch blocker. **P2:** accessibility, consistency, performance, or maintainability improvement. “Source finding” means it was traced in code but not reproduced with an end-to-end destructive scenario.

### A01 — Project switching can leave a buffer attached to the wrong filesystem context

**P0 · source finding; data-loss scenario requires a controlled reproduction.**

`EditorWorkspace` sends only a relative file path and text to `writeProjectFile`. The main process resolves that path against the mutable global `focusedSpaceId`. `App.startSpace()` changes projects before the editor's `projectKey` effect asks whether to discard edits. Cancelling that prompt preserves the old buffer but does not roll back the main process's focused project.

If projects A and B both contain `README.md`, a dirty A buffer retained after switching to B can subsequently be saved using B's root. The global Ctrl+S handler and close-save callback make this worth treating as a data-integrity risk, not merely a confusing label.

**Fix:** bind every buffer and filesystem IPC request to an immutable project ID; resolve/authorize the root from that ID. Complete save/discard/cancel before switching focus. Cancel must leave both renderer and main process on the original project.

**Acceptance:** in temporary A/B projects with identical filenames, test save, discard, cancel, rapid switching, and closing; verify both files byte-for-byte afterward.

Evidence: [EditorWorkspace.tsx](../../lantern/src/components/EditorWorkspace.tsx), [App.tsx](../../lantern/src/App.tsx), [main.ts](../../lantern/electron/main.ts).

### A02 — Valid external links are rejected

**P1 · reproduced in Electron.**

Calling `electronAPI.openExternal('https://example.com')` returned `Only http(s) links can be opened`. The `handle()` wrapper supplies the IPC event first, but `shell:openExternal` treats its first argument as the URL. It validates the event object instead of the supplied URL.

**Fix:** accept `(event, url)` consistently; validate the actual URL and retain the protocol allowlist. Test supported links and rejected protocols. The audit stubbed the OS browser-opening operation, so no external browser was launched.

Evidence: [desktop-results.json](desktop-results.json), [main.ts](../../lantern/electron/main.ts), [preload.ts](../../lantern/electron/preload.ts).

### A03 — Desktop Live Preview navigation is blocked

**P1 · reproduced in the packaged renderer.**

A local HTTP iframe stayed at an empty frame URL. `will-frame-navigate` rejects every URL in production because `VITE_DEV_SERVER_URL` is absent. This conflicts with the deliberate localhost iframe in `PreviewPanel`. Separately, its URL validator accepts HTTPS and IPv6 loopback, while the renderer CSP only lists HTTP localhost and 127.0.0.1.

**Fix:** distinguish top-level navigation from an approved preview subframe; allow only the intended loopback destinations in both policies. Add loading/error/timeout feedback so a failed preview does not look like an empty project.

**Acceptance:** local HTTP preview loads, refresh works, internal navigation works, approved address variants behave consistently, and remote top-level navigation remains blocked.

Evidence: [desktop-results.json](desktop-results.json), [PreviewPanel.tsx](../../lantern/src/components/PreviewPanel.tsx), [main.ts](../../lantern/electron/main.ts), [vite.config.ts](../../lantern/vite.config.ts).

### W01 — Waitlist and contact destinations are not configured

**P1 · verified by the current build gate and source.**

The latest `site:check` refuses to build because 10 required values remain TODO: legal name/address/jurisdiction, three contact inboxes, waitlist destination, documentation URL, repository slug, and copyright holder. Raw source preview exposes unresolved tokens. The waitlist is now the primary conversion action, so it needs a real destination before a public deployment is useful.

**Fix:** supply approved values and verify the chosen waitlist flow. Keep the current pre-release positioning; do not invent prices, checkout links, or release artifacts. Preserve the build gate.

**Acceptance:** no unresolved tokens in deploy output; signup completes in a test flow with success/error feedback; contact links resolve to the intended inboxes.

Evidence: [site.config.json](../../olympus-web/site.config.json), [build-site.mjs](../../lantern/tools/build-site.mjs).

### W02 — Production headers block the website's embedded demos

**P1 · reproduced with the configured CSP.**

`demo-live.js` embeds local demo-project HTML in iframes. The global header applies `frame-ancestors 'none'` and `X-Frame-Options: DENY` to those child documents too. With production headers applied, the demo frame is blocked even though ordinary local preview works.

**Fix:** give only `/assets/demo-projects/*` an appropriate same-origin embedding policy while retaining protection on the public pages. Verify the complete resulting header set, not just one directive.

**Acceptance:** all sample project frames load under production-equivalent headers, while external framing of public pages remains denied.

Evidence: [production-results.json](production-results.json), [netlify.toml](../../olympus-web/netlify.toml), [demo-live.js](../../olympus-web/demo-live.js).

### W03 — Inline styles/scripts disagree with production CSP

**P1 · verified by browser policy violations and source.**

The configured `style-src` disallows inline styles, but many pages contain style attributes. The new `app.html` also contains an inline stylesheet and inline interaction script; `script-src 'self'` blocks that script. The production-header run collected 73 CSP errors across its original route matrix, including both styling and framing errors; that is not 73 distinct bugs.

**Fix:** extract page styles and scripts into external files and replace static inline styles with classes. Do not broadly weaken the security policy just to hide the warnings. Curtain row positioning was moved to external CSS during this session.

**Acceptance:** `app.html` retains its layout and approval/disclosure interactions with production headers; no unintended CSP violations on any route.

Evidence: [app.html](../../olympus-web/app.html), [netlify.toml](../../olympus-web/netlify.toml), [production-results.json](production-results.json).

### A04 — Modal keyboard focus escapes to the underlying app

**P1 · reproduced.**

Opening “New agent” and tabbing allowed focus outside the element marked `aria-modal="true"`. ProjectPicker sets initial focus and handles Escape but does not trap focus or restore it to the trigger.

**Fix:** use one accessible dialog implementation for project picking and project creation, including focus containment, trigger restoration, background inertness, and Escape behavior.

**Acceptance:** repeated Tab/Shift+Tab stays in the dialog; Escape closes it and returns focus; keyboard users cannot activate background controls while it is open.

Evidence: [desktop-results.json](desktop-results.json), [ProjectPicker.tsx](../../lantern/src/components/ProjectPicker.tsx), [ProjectsPage.tsx](../../lantern/src/components/ProjectsPage.tsx).

### A05 — Licensing data is out of step with current product positioning

**P2 before public release · runtime/source finding.**

The license API returns `trialDays: 14`, `trial: true`, and a 14-day countdown. The website previously advertised an unlimited free build and now describes an unreleased product with undecided commercial terms. The main window is deliberately **not** gated by this state, so this audit did not find a 14-day lockout. The signing code also reads a runtime environment variable; packaging comments claiming a build-time embedded secret do not establish that implementation.

**Fix:** make the current development state explicit and remove obsolete countdown/activation assumptions until a licensing model is chosen. Before any paid release, design and test issuance, activation, offline validation, and update entitlement end to end.

Evidence: [license.ts](../../lantern/electron/license.ts), [desktop-results.json](desktop-results.json), [site.config.json](../../olympus-web/site.config.json).

### R01 — Repository CI/release workflows are nested below the repository root

**P1 for automated releases · source finding.**

Git reports the repository root as `Project - Copy`, while workflows are under `lantern/.github/workflows`. Those files are not in the root workflow directory for this checkout. Moving them alone would also require correcting npm working directories and lockfile cache paths.

**Fix:** place workflows at the repository root and explicitly run app commands in `lantern`; verify the actual remote layout before enabling publication.

**Acceptance:** a test PR triggers the intended checks; a non-publishing packaging run produces the expected artifacts on each supported OS.

Evidence: [CI workflow](../../lantern/.github/workflows/ci.yml), [release workflow](../../lantern/.github/workflows/release.yml).

### R02 — Lint gate fails

**P2 · reproduced.**

`npm run lint` reports 3 errors and 35 warnings. Errors include unused `get` and `rendered` variables in `tools/build-site.mjs` and an unnecessary escaped hyphen in `tools/tokenise-placeholders.mjs`. Warnings include effect-driven state updates and ref access during render. Warnings should be reviewed individually; the audit does not treat every warning as a proven user-facing bug.

**Fix:** eliminate the three errors; prioritize warnings around terminal fitting, state races, and repeated renders, then add lint to the enforced CI gate.

### R03 — Installer/release readiness is unverified

**P1 before distributing installers · source finding and test gap.**

Build success verifies JavaScript compilation, not signing or installation. `electron-builder.yml` still contains TODO copyright metadata and has notarization disabled. Signing credentials and real installer behavior were not inspected or tested. Both entitlement files referenced by the configuration exist; the unusual `entitlemas` filename is not itself evidence of a missing file.

**Fix:** validate packaging metadata, signing/notarization, artifact names, clean install, launch, uninstall, and upgrade on each supported OS before release.

Evidence: [electron-builder.yml](../../lantern/electron-builder.yml).

### V01 — Artwork direction and framing drift

**P2 · visually verified; corrections implemented in the active artwork pass.**

The previous small portrait crops could not support large banners. The first generated replacements also diverged from the original: cute owl, warm-skinned fantasy characters, over-detailed painterly backgrounds, and inconsistent contour weight. Changing image dimensions alone cannot correct an art-direction mismatch.

**Fix approach used:** regenerate rejected scenes with the actual original image attached as the style reference; preserve each composition with responsive sizing. Use a visual acceptance sheet before adding future artwork. Check full head/helmet, edge padding, cloud material, contour weight, and text clearance at desktop and mobile sizes.

### V02 — Marketing demos and the actual app disagree

**P2 · screenshot/source finding.**

`app.html` describes the “actual Olympus interface” but presents dark reconstructed panels, while the running app is light. The homepage uses Agent/Code/Thread wording while the app's mode strip includes Chat/Agents/Code/Thread. Current production styling also maps the Tailwind `sans` family to Times New Roman, creating a noticeably different density from the marketing site's mixed typography.

**Fix:** use captured app states or explicitly label simplified mockups; align mode labels and interaction descriptions. Decide on one intentional typography system for dense controls rather than silently swapping the whole UI's font family.

Evidence: [app.html](../../olympus-web/app.html), [desktop screenshot](screenshots/desktop-start.png), [WorkspaceBar.tsx](../../lantern/src/components/WorkspaceBar.tsx), [tailwind.config.js](../../lantern/tailwind.config.js).

### V03 — Mobile homepage is dominated by a long demo

**P2 · visually verified.**

The recorded 390px homepage is approximately 9,600px tall. The transcript expands naturally and the embedded demo has an 800px mobile minimum height. The result pushes the product explanation and signup information far down the page. Small 8–11px demo details are difficult to read even without horizontal overflow.

**Fix:** offer a concise mobile demo with an explicit expand action, shorten the initial transcript, and prioritize a readable preview over desktop-like information density. Keep the full experience available on demand.

Evidence: [mobile screenshot](screenshots/index-390.png), [olympus.css](../../olympus-web/olympus.css).

### X01 — Website accessibility failures

**P2 · automated findings, not a complete accessibility certification.**

The homepage has a gold status label measured at **4.49:1** against white where 4.5:1 is required, and the horizontally scrollable provider row is not keyboard-focusable. `app.html` additionally produces contrast failures; mobile also has scrollable-region findings. Other audited routes had no violations in the selected axe ruleset.

**Fix:** darken the status text slightly, make scrollable content operable by keyboard, correct the walkthrough colors, and follow with manual focus/screen-reader testing.

### X02 — Desktop contrast and list semantics

**P2 · reproduced with axe.**

Project-manager supporting text measured **2.45:1** and **2.56:1**, below the 4.5:1 requirement for its small text. Sidebar's empty-project paragraph is a direct child of a `ul`, producing an invalid-list finding.

**Fix:** use a readable muted-text color and place the empty state outside the list or inside a proper list item. Check the same tokens in model pickers, terminal headers, and status labels.

Evidence: [desktop-results.json](desktop-results.json), [Sidebar.tsx](../../lantern/src/components/Sidebar.tsx).

### P01 — Monaco still starts loading in the hidden editor

**P2 · source finding.**

`App` keeps `EditorWorkspace` mounted and merely changes its display. Its mount effect calls `ensureMonaco()` unconditionally, despite the comment saying it loads only when the view is on screen. The production build reports large chunks: approximately 2.65MB for the editor API, 1.27MB for another editor bundle, and 1.04MB for the main bundle before gzip; the TypeScript worker is also large. Size alone is not a measured startup regression, but the supposed lazy-load boundary is ineffective.

**Fix:** trigger editor initialization on first visible use, preserve loaded state afterward, and measure time-to-interactive and memory before/after.

Evidence: [App.tsx](../../lantern/src/App.tsx), [EditorWorkspace.tsx](../../lantern/src/components/EditorWorkspace.tsx), [monacoSetup.ts](../../lantern/src/components/monacoSetup.ts).

### P02 — Startup log displays fabricated success messages

**P2 · source finding.**

`OlympusBoot` cycles through cosmetic lines including “resolving opencode on PATH… ok” and a random handshake ID independently of actual environment checks. This can contradict real startup failure and makes diagnosis harder.

**Fix:** connect displayed milestones to actual results; use neutral descriptive loading text where no measured milestone exists. Respect reduced motion in component-driven animation too.

### M01 — Unversioned assets are cached as immutable for one year

**P2 · source finding.**

`/assets/*` receives `max-age=31536000, immutable`, but many filenames are stable and are replaced in place. Returning users can keep an old illustration after a deploy. New corrected artwork uses `-v2` filenames, avoiding that particular stale URL.

**Fix:** content-hash assets at build time or shorten/revalidate caching for unversioned filenames. Test repeat visits across a deployment.

Evidence: [netlify.toml](../../olympus-web/netlify.toml).

### M02 — Duplicated CSS and incomplete route metadata invite drift

**P2 · source finding.**

Motion and cartoon rules exist both in separate source files and in the checked-in `olympus.css` concatenation. The site build substitutes tokens/copies files rather than rebuilding that stylesheet. Updating only one copy has no guaranteed effect. The sitemap omits newer `about.html`, `faq.html`, and `app.html` routes.

**Fix:** give stylesheet assembly one reproducible build step or load one authoritative source per concern; generate/check route metadata from the same page inventory.

## Prioritized execution plan

| Order | Work | Completion criteria |
|---|---|---|
| 1 — Protect editing | Reproduce A01 with temporary projects; bind file reads/writes to project IDs; guard switching and closing. | Save/discard/cancel, rapid switching, and close-save cannot alter the wrong project or silently lose the old buffer. |
| 2 — Repair broken app paths | Correct external-link IPC; allow only approved preview subframes; align localhost validation/CSP; add preview error states. | Valid links open once; invalid schemes stay blocked; local preview loads, refreshes, and reports failures. |
| 3 — Make the public site work as deployed | Configure the waitlist/contact values; fix child-frame headers; extract inline page assets; test `app.html` with actual deployment headers. | `site:check` passes, no unresolved tokens, signup tested, demos functional, no unintended CSP violations. |
| 4 — Accessibility and consistency | Focus containment; contrast/list fixes; keyboard scrolling; consistent mode names and honest demo labeling. | Selected axe rules pass and manual keyboard workflows complete without losing focus or trapping the user. |
| 5 — Performance and mobile polish | True on-demand Monaco loading; shorter mobile demo; real startup milestones; consistent artwork crops and readable type. | Measured startup comparison and approved screenshots at 320/390/768/1440px plus zoom checks. |
| 6 — Establish release gates | Relocate workflows; clear lint errors; automate asset/link checks; version assets; validate signed packages when release plans are settled. | CI runs from this repository layout and release artifacts pass clean-machine tests. |

The stages are ordered by consequence, not cosmetic effort. Artwork fixes can be reviewed immediately; file integrity and broken runtime behavior should be resolved before expanding features. Product-specific destinations and commercial decisions must come from the owner, while implementation and regression checks can proceed independently.

## Verification still required

- Reproduce the A01 cross-project save scenario in disposable fixtures before changing editor lifecycle code.
- Real task streaming, abort, reconnect, queued sends, edit approval/rejection, Git operations, terminal execution, and concurrent project work.
- Manual screen-reader testing, 200% browser zoom, high-DPI artwork inspection, real Safari/Firefox and mobile hardware.
- Actual hosted headers/cache behavior and waitlist submission after configuration is supplied.
- Clean Windows installer, macOS signing/notarization and launch, Linux packaging, upgrades, and uninstall behavior.

This audit provides confirmed failures and code-backed risks within the stated coverage; passing compilation or automated accessibility checks does not prove the remaining workflows correct.
