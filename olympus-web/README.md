# olympus-web

The marketing and documentation site for **Olympus**, a local-first desktop GUI
and execution harness for the `opencode` coding agent.

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
| Canonical origin | `https://olympus.example.com/` | every `<link rel="canonical">`, every `og:url`, every absolute `og:image` / `twitter:image`, `robots.txt`, `sitemap.xml`, the JSON-LD `url` |
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

The four real build files, behind the three download buttons:

| Platform | Expected filename | Download button |
| --- | --- | --- |
| macOS, Apple Silicon | `Olympus-0.1.0-arm64.dmg` | `data-download="macos"` |
| macOS, Intel | `Olympus-0.1.0-x64.dmg` | the same `data-download="macos"` button |
| Windows 10 / 11, 64-bit | `Olympus-0.1.0-setup.exe` | `data-download="windows"` |
| Linux x64 | `olympus_0.1.0_amd64.AppImage` | `data-download="linux"` |

Note the shape of the problem: the macOS button is one link and the Intel
build is a second file. `script.js` marks exactly one button per platform as
`is-pick`, so the Intel file needs its own link somewhere on `pricing.html`
or in the documentation, or it is unreachable. Decide whether to add a fourth
button or point the macOS link at a small platform-chooser page.

### Legal entity

These are bracketed in the body text of the four legal pages, and the whole
set of them needs a lawyer or at least a competent review before a licence is
sold:

- `[LEGAL NAME]` — the selling individual or entity. `license.html`, `terms.html`, `privacy.html`, `refunds.html`
- `[REGISTERED ADDRESS]` — same pages
- `[REGISTERED ADDRESS FOR SERVICE OF PROCESS]` — `terms.html` section 13, `license.html` section 12
- `[THE LICENSOR]` / `[THE SELLER]` — defined-term shorthands in `license.html` and `terms.html`
- Selling jurisdiction, and the statutory-rights carve-outs in `license.html` sections 5 and 6, `terms.html` section 8, `privacy.html` section 8, and the consumer-law paragraph in `refunds.html`
- The data-controller identity and any named representative or regulator, `privacy.html` section 1
- Retention period for tax records, `privacy.html` section 4
- Name of the payment processor and a link to its terms, `privacy.html` section 4
- Whether a data-controller registration is required in the selling jurisdiction

### Version facts to confirm

- `1.18.x` is stated as the known-good `opencode` line in `index.html`, `requirements.html`, `changelog.html` and `refunds.html`. Check it against the shipped build before publishing.
- `0.1.0` and the dates `2026-09-28` / `2026-09-29` in `changelog.html`, `sitemap.xml` and the four legal pages. The changelog has exactly one entry and no invented history, which is deliberate.
- The "known rough edges" list in `changelog.html` — that has to be true.

### Favicons

`assets/favicon-32.png`, `assets/favicon-512.png` and
`assets/apple-touch-icon.png` are generated from the same mark as the inline
SVG favicon, using only colours already in the token set
(`--aegean-deep`, `--helios`, and the marble of `--temple`). The generator
that produced them is not kept in this directory; the SVGs in
`index.html:…` (`<link rel="icon" href="data:image/svg+xml,…">`) are the
source of truth for the mark and are hand-written. If the mark changes, both
need regenerating.

---

## Structure

```
index.html            Landing page. Hero + mock window, three questions,
                      #pricing (price, refund, three downloads, three cards),
                      #compare (table against the raw opencode CLI),
                      #faq (thirteen <details>).
features.html         What is in the window
how-it-works.html     The four steps, plus the free-vs-paid block
pricing.html          Full commercial detail: what is in the box, what is
                      not, what a major version would cost, volume seats
security.html         The four real mechanisms, then the six things it does
                      NOT protect you from
requirements.html     Four prerequisites, three platforms, and the opencode
                      compatibility note (#opencode)
changelog.html        0.1.0, first public build
license.html          End-user licence
terms.html            Terms of sale
privacy.html          Privacy policy
refunds.html          Refunds
robots.txt
sitemap.xml
styles.css            One file. Tokens in section 01, layout in 02–13,
                      new commerce components in 14–18, scrub in 19,
                      motion in 20, responsive in 21.
script.js             Scroll pass, mobile nav, entrance, pointer tilt,
                      mock approval loop, analytics hook, OS ordering.
assets/               Two JPEGs and three generated PNGs.
```

## The design system

Everything on the site comes from one drawing: a marble temple on a warm
stone ridge under a radiant gold sun, in an Attic frieze. The rules that keep
it coherent, so that future edits do not break it:

1. **No new colours.** Every colour is a custom property in `styles.css`
   section 01, lifted from that drawing. No hex literals outside section 01
   and the frieze SVG, no gradients anywhere, and no red — the palette has no
   red in it, so a "not included" mark is a struck stone rule, not a cross.
2. **Carved stone, not moulded plastic.** `--r: 3px` and nothing softer.
3. **Flat fields only.** Solid fills and cut outlines. The only shadow in the
   stylesheet is the hard 7px offset block under a hovered card.
4. **The zigzag bar closes every block.** `.section::before` draws it
   automatically; `.card-lg` carries its own across the top edge. Reuse it
   rather than inventing a new rule ornament.
5. **Three typefaces only.** `Fraunces` for headings, `Archivo` for body,
   `JetBrains Mono` for code. Loaded from Google Fonts, which is the single
   third-party request the site makes.
6. **Scroll is the only clock.** Animation is a pure function of scroll
   position — `--p` per element, `--pg` for page progress — so scrolling up
   plays the page backwards. `script.js` sets those two properties and
   nothing else; every visual is CSS. New sections are annotated
   `data-scrub` and the gold run on their heading fillet is the one thing that
   consumes it. Do not add a third scroll-driven effect: an earlier draft
   scrubbed all 38 blocks on the page and the result was a page that twitched
   at you.
7. **Reduced motion is real, not decorative.** `@media (prefers-reduced-motion: reduce)`
   in `styles.css` kills every animation and transition, pins
   `scroll-behavior` back to `auto`, and forces the scroll-linked ornament
   and every gated entrance to its finished state. Anything added later needs
   a line in that block.

## Analytics hook

`script.js` defines a `track(name, props)` function that does exactly two
things: it dispatches

```js
document.dispatchEvent(new CustomEvent('olympus:analytics', { detail }))
// detail = { name, props, page }
```

on `document`, and it calls `console.debug`. It has no listener and no
destination, so it is a no-op as shipped.

Events currently emitted: `download` (with `props.os`), `cta`, `nav` (with
`props.to` and `props.label`), and `faq_open` (with `props.question` and
`props.label`) when an FAQ `<details>` is opened.

To wire a tool in later, add one listener in `script.js` — do not edit the
call sites:

```js
document.addEventListener('olympus:analytics', function (e) {
  // e.detail.name, e.detail.props, e.detail.page
});
```

**If you ever do wire something up, it must be self-hosted or otherwise
privacy-respecting.** Shipping a third-party tracker with a product whose
entire pitch is that nothing leaves your machine would make the pitch false.
A self-hosted, cookieless, aggregate-only counter is defensible. Google
Analytics is not, and the copy on the site would then need changing.

## Accessibility notes

- Skip link, `<main id="main">`, labelled `<nav>` landmarks and a `<footer>`
  on every page.
- The mobile menu is a real `<button>` with `aria-expanded` and `aria-controls`;
  Escape closes it and returns focus.
- The mock window is a `role="img"` with a full `aria-label`, and its
  `figcaption` says plainly that it is an illustration, not a screenshot.
- The compare table is a real `<table>` with `scope` on every header, in a
  labelled, focusable scroll region so it is keyboard-reachable on a phone.
- The FAQ is `<details>`/`<summary>` and needs no script to work.
- Download buttons carry a text `<span class="dlbtn__tag">Yours</span>` that
  is `display: none` until `script.js` adds `is-pick`, so the "yours" marker
  never appears without a matched platform and the bar links keep their
  explicit `aria-label` either way.
- Visual order and tab order agree everywhere. `script.js` reorders the
  download buttons in the DOM rather than with the CSS `order` property,
  specifically to keep them the same.

## Adding a page

Copy the head of an existing page, keep the `SITE CONSTANTS` comment block at
the top of `<head>`, and keep the header and footer byte-identical apart from
`aria-current="page"`. New prose goes in `.prose`; new commercial blocks go
in `.panel` or `.card-lg`; new long-form listings go in `.ticks` or `.reqs`.
Sections get `data-scrub` and a `.sec__head sec__head--fill` with a
`<span class="fillet">` inside it. Then re-run the anchor check: every `href`
ending in `#` must resolve to an `id` in the same file.
