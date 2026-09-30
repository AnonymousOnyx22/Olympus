# olympus-web

The marketing and documentation site for **Olympus**, an independent agent
harness for coding workflows. Position the product around agents, models,
projects, and user choice, rather than any single provider or agent backend.
Only describe specific integrations as supported when verified in the current build.

Vanilla HTML, CSS and JavaScript. No framework, no build step, no package
manager, no dependencies. Open `index.html` in a browser and the whole site
works.

---

## TODO before launch

Every value below is a placeholder. The site renders and reads correctly as
shipped, and every placeholder is on a domain reserved by RFC 2606
(`example.com`), so none of the links resolve to anything real. Replace them
all, then re-check the anchors listed at the bottom of this file.

### Origins and social

| What | Placeholder in use | Appears in |
| --- | --- | --- |
| Canonical origin | `https://projectclipforge.netlify.app/` | every `<link rel="canonical">`, every `og:url`, every absolute `og:image` / `twitter:image`, `robots.txt`, `sitemap.xml`, the JSON-LD `url` |
| Twitter / X handle | `@olympusapp` | every `<meta name="twitter:site">` |
| Documentation | `https://docs.example.com/olympus` | every footer, plus `index.html`, `requirements.html` |

### Email addresses

| What | Placeholder in use | Appears in |
| --- | --- | --- |
| Support | `support@example.com` | every footer, every page body, `privacy.html`, `terms.html`, `refunds.html` |
| Security reports | `security@example.com` | every footer, `security.html`, the FAQ, all four legal pages |

Set up both as real mailboxes. `security@example.com` must be monitored by
someone who can act; the site tells readers to use it *instead of* a public
issue, so a dead address makes that instruction a trap.

### Commercial

| What | Placeholder in use | Appears in |
| --- | --- | --- |
| Checkout | `https://buy.example.com/olympus` | `index.html` (twice), `pricing.html` (twice), `how-it-works.html` |
| Download root | `https://downloads.example.com/olympus/0.1.0/` | `index.html`, `pricing.html`, `how-it-works.html`, `changelog.html`, every header |

The expected four build files, linked from the download sections:

| Platform | Expected filename | Download button |
| --- | --- | --- |
| macOS, Apple Silicon | `Olympus-0.1.0-arm64.dmg` | `data-download="macos"` |
| macOS, Intel | `Olympus-0.1.0-x64.dmg` | the same `data-download="macos"` button |
| Windows 10 / 11, 64-bit | `Olympus-0.1.0-setup.exe` | `data-download="windows"` |
| Linux x64 | `olympus_0.1.0_amd64.AppImage` | `data-download="linux"` |

The main macOS button targets Apple Silicon. A separate Intel Mac link is
available in every download section.

### Legal entity

These are bracketed in the body text of the four legal pages, and the whole
set of them needs a lawyer or at least a competent review before a licence is
sold:

- `[LEGAL NAME]`: the selling individual or entity. `license.html`, `terms.html`, `privacy.html`, `refunds.html`
- `[REGISTERED ADDRESS]`: same pages
- `[REGISTERED ADDRESS FOR SERVICE OF PROCESS]`: `terms.html` section 13, `license.html` section 12
- `[THE LICENSOR]` / `[THE SELLER]`: defined-term shorthands in `license.html` and `terms.html`
- Selling jurisdiction, and the statutory-rights carve-outs in `license.html` sections 5 and 6, `terms.html` section 8, `privacy.html` section 8, and the consumer-law paragraph in `refunds.html`
- The data-controller identity and any named representative or regulator, `privacy.html` section 1
- Retention period for tax records, `privacy.html` section 4
- Name of the payment processor and a link to its terms, `privacy.html` section 4
- Whether a data-controller registration is required in the selling jurisdiction

### Version facts to confirm

- Confirm current agent and model compatibility against the shipped build before publishing.
- `0.1.0` and the dates `2026-09-28` / `2026-09-29` in `changelog.html`, `sitemap.xml` and the four legal pages. The changelog has exactly one entry and no invented history, which is deliberate.
- The "known rough edges" list in `changelog.html`: that has to be true.

### Brand assets

The browser favicons are existing assets. The refreshed navigation mark lives in
`assets/olympus-mark.svg`. Original Gemini JPEGs are preserved as references only. The site uses newly
generated artwork; see `assets/ARTWORK.md` for exact prompts and provenance.

---

## Structure

The site has 11 HTML pages. All share `design.css`, `cartoon.css`, `motion.css`, `demo-live.css`,
`site.js` and `motion.js`. The homepage also loads `demo-live.js`.

- `index.html`: artwork hero, interactive workspace, three views, edit review,
  local models, free downloads, licence, comparison, FAQ, final call to action.
- `features.html`, `how-it-works.html`, `pricing.html`: product and setup.
- `security.html`, `requirements.html`, `changelog.html`: technical details.
- `license.html`, `terms.html`, `privacy.html`, `refunds.html`: legal content.
- `design.css`: shared visual tokens, typography, components and responsive layouts.
- `site.js`: mobile navigation, accessible demo tabs, sample edit approval and OS hints.
- `assets/olympus-athena.png`: original generated Athena sculpture, hero and social preview.
- `assets/olympus-sanctuary.png`: original generated sanctuary, local-first section and page headers.
- `assets/olympus-mark.svg`: small vector temple mark for navigation and the demo.

The previous `styles.css` and `script.js` are retained as legacy design references;
they are no longer loaded by any page.

## Visual direction

The supplied Gemini artwork inspired the visual direction only: sculpted marble,
clouds, open sky, and restrained gold. The displayed illustrations are original
images generated with the built-in image-generation tool; both final prompts are
documented in `assets/ARTWORK.md`. Marcellus supplies classical display type; Manrope keeps
navigation and body text readable. Google Fonts is the only third-party asset
request. CSS tokens in `design.css` define marble white, cloud grey, sky blue,
deep blue ink and muted gold. A single Greek-key band separates the hero.

The homepage leads with the statue, then gives the product illustration a full
width section. Inner pages use a consistent, softly illustrated page header,
readable content widths, shared navigation and a shared footer. Legal copy and
commercial terms remain in the corresponding pages.

## Local preview

From this directory:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Visit http://127.0.0.1:4173/. No build or dependency installation is required.
The pages also work when opened directly from disk.

## Interactions and accessibility

- The workspace is explicitly labelled as an illustration using sample data.
  Agent, Code and Thread tabs support arrow keys, Home and End. Accepting the
  sample edit updates all three views; Reset demo restores the original state.
- The demo does not launch a model, open a terminal, edit files or send requests.
- The mobile menu supports Escape, click outside and closing on navigation.
- FAQs use native details/summary. Comparison tables scroll within a labelled,
  keyboard-focusable region at narrow widths.
- Skip links, one main landmark, one h1 per page and visible focus styles are shared.
- Motion is limited to smooth anchor scrolling and short interaction transitions;
  reduced-motion settings disable both. Content never depends on scroll reveals.
- Downloads retain all OS choices, including a separate Intel Mac link. Desktop
  OS hints do not identify Android, iOS or ChromeOS as supported desktop systems.
- No analytics, cookies or storage are added. The existing download, checkout,
  contact and legal placeholders above still need real values before launch.

## Verification

Browser-checked across all 11 pages at 1440, 768, 390 and 320 pixels wide, with
no page-level horizontal overflow or missing images. Demo switching, keyboard
navigation, shared approval state, reset, FAQ disclosure and mobile menu dismissal
were exercised in Chromium. Recheck local links and fragment IDs after content edits.


## Current interactive design

- Original artwork is cartoonized in `assets/olympus-cartoon-hero.png` and
  `assets/olympus-cartoon-sanctuary.png`. Exact built-in image tool prompts are in
  `assets/CARTOON-ARTWORK.md`. The hero is a full background with centred copy.
- `cartoon.css` sets outlined buttons, warm gold accents and illustrated panels.
- `motion.js` / `motion.css` provide moving clouds, hero discovery, reading
  progress, scroll animations that replay in both directions, view transitions,
  preview themes and acceptance feedback. Reduced motion disables animation.
- The thicker Greek divider has a blue ground and yellow linework.
- `assets/brands/` contains solid-white Simple Icons SVGs on a blue section.
  Sources and provenance are recorded in `assets/brands/sources.json`. Brand
  presence describes the wider ecosystem, not guaranteed integrations.
- `demo-live.js` is the current homepage demo; `demo.js` is an earlier unused
  version. Each project retains its own conversation, draft, accepted changes,
  model selection, and pending review for the lifetime of the page.
- Preparation, review, planning and streamed replies are scripted. No model is
  connected, no model weights are loaded, and no private model reasoning is shown.
- Visitors can pause/replay, change projects, inspect files, request headlines,
  cards or contact forms, accept/reject/undo, and use the generated preview.
  Contact forms validate locally and never send or save an email address.
- Runs pause outside the viewport and in hidden tabs. Reduced-motion mode skips
  streaming. User text is escaped before display. New requests replace only the
  pending run in their own project. Reset affects only that project.


### Continuous demo playback

The visible project cycles through headline, cards, form and colour changes,
streams replies, reviews its scripted edits, and updates the preview. History
is capped at 60 messages per project. Pause stops both writing and idle stages.
Typing, focused form controls and recent interaction hold automatic activity;
a visitor's own proposal always waits for an explicit accept or reject.
Offscreen/hidden pages suspend the clock. Reduced motion disables automatic
continuation and immediately completes manually requested replies. Reset pauses
that project until Resume. The model activity remains explicitly scripted.


### Greek thinking animation

The demo now holds each scripted request in a quiet 14-second thinking state.
A CSS-animated SVG temple, glowing columns and orbiting laurel replace typing
and streamed code. Replies and proposed changes appear complete after thinking.
The thinking DOM remains mounted between ticks, so the animation is smooth;
Pause, hidden/offscreen handling, visitor interaction holds and reduced motion
still apply. Styling lives in `thinking.css`.

### Compact static thinking example
The Agent and Thread views now show a fixed subscription-guard transcript. Only a 16px Greek temple glyph animates beside Testing. No transcript scrolling, typing, timed replies, or automatic edits. Pause/Resume controls the animation; the "esc to interrupt" hint is display text only. Reduced motion is respected. The transcript is a scripted example, not model output.

### Working project previews
The workspace now loads three standalone apps from `assets/demo-projects/`. Studio North has category filters and case-study dialogs. Little Notes supports creating, editing, searching, pinning and deleting notes. Weekend Club supports per-day plans, chronological ordering, completion and removal. Notes and plans use separate localStorage keys with a session-only fallback if storage is unavailable. Each project has a distinct, static scripted walkthrough; only the small Greek activity glyph animates. Code view fetches the actual HTML, CSS and JavaScript used by each preview. No model calls or external services are used.
