# Olympus review — 2 October 2026

The homepage stays unchanged. The desktop application's existing colours stay unchanged. This review adds audit scripts, results and screenshots only; it does not modify product source files.

Olympus has a recognizable identity and a working foundation. The most useful next work is to align product promises with actual behaviour, fix connection and permission state, and make the inner pages explain the product with clearer layouts and current screenshots. A broad rebrand would be unnecessary.

## What was checked

- Current local desktop and website source, including the existing uncommitted changes.
- Desktop production build and TypeScript: passed.
- Automated tests: 124 passed, one skipped, across 15 test files.
- ESLint: zero errors, 45 warnings, including state updates inside effects and ref access during render. These warnings are maintenance/performance concerns, not 45 demonstrated user-facing bugs.
- Website: 16 HTML pages at 1440, 390 and 320 CSS pixels, served with the configured production Content Security Policy. No missing images after loading lazy images, page-level horizontal overflow, page JavaScript exceptions, or broken local links/fragments.
- Browser interactions: mobile menu/Escape, FAQ filtering and recovery, local waitlist feedback, homepage keyboard tabs, and creating a note in the embedded preview passed.
- Freshly built Electron app launched with separate temporary user data; inspected Projects, Station and Connections. No real credentials or model prompts were submitted. A Workspace screenshot timed out in automation, so a full Workspace visual/functional pass is not claimed. Requested desktop window sizes were not reliably reflected in captured dimensions; these captures are visual evidence, not a minimum-window-size certification.
- No live deployment, real signup delivery, real third-party authentication, end-to-end model task, macOS build or Linux build was verified.

Evidence: [website results](website-results.json), [interaction results](interactions.json), [desktop results](desktop-results.json), and [screenshots](screenshots/).

## Highest-priority functional findings

### 1. Cancelling browser login can mark an account connected — reproduced

`electron/browserSignIn.ts:78` treats the existence of a session file as authentication. Closing the login window exports cookies whether authentication succeeded or not. `ConnectionsSettings.tsx:215` then displays Connected/signed in.

In the isolated Electron test, the Etsy login URL was intercepted and replaced with `about:blank`; closing that window produced `browserSessionConnected: true` with `{cookies: [], origins: []}`. No provider request or login was needed to obtain the connected state.

**Change:** distinguish Cancelled, Session saved, Verified and Expired. Verify a useful authenticated operation before saying Connected. Preserve a working session when a subsequent sign-in attempt is cancelled. Surface export errors rather than swallowing them. Tests currently cover file existence but not successful authentication.

### 2. Connection privacy promises exceed the implementation — source-confirmed

`ConnectionsSettings.tsx:180` says both keys and sign-ins are encrypted and never sent to a model or shown in chat. Secret API fields are encrypted through Electron safeStorage, but `browserSignIn.ts:113–120` writes reusable browser cookies to readable JSON. File permissions are not encryption. The exported state also omits origin storage, which may matter for providers whose authentication relies on more than cookies.

`main.ts:158–160` gives every project's daemon all saved connection credentials/session paths. `daemonManager.ts` makes that environment available to child processes. Therefore, an agent-run command can read those values; the implementation does not substantiate the absolute promise that they can never appear in tool output or reach a model. No actual leakage was observed or attempted.

**Change:** describe the real boundary accurately; protect browser session exports; prefer scoped access and a credential broker over broadly inherited secrets. Review per-project access as a product decision. Do not remove existing automatic sharing without considering the intended workflow, but make that access explicit.

### 3. Permission label can disagree with a running project's permissions — source-confirmed risk

`App.tsx:526` saves one global permission setting and restarts only the active space. `main.ts:137` reuses another running space by directory/status without comparing permission mode. When switching spaces, `App.tsx:218` reads the global setting to populate the UI.

Scenario to reproduce next: start project A with Full access; switch to B and select Ask; return to A. The UI can read Ask from global settings while A's existing daemon retains Full access. The reverse can also leave unexpected approval prompts. This was traced in code, not exercised with real commands.

**Change:** track the effective permission mode per running daemon and display that value. Make any global default separate from current project permissions. The How it works statement that every project keeps its own permission mode should match the resulting behaviour.

### 4. Live Preview discovery is not associated with the current project — source-confirmed

`main.ts:290` scans conventional localhost ports and returns the first response below HTTP 500. `PreviewPanel.tsx:49` calls discovery without a project identifier. With two dev servers open, Auto-find can choose another project's website; even a 404 response qualifies.

**Change:** remember a preview URL per project, associate launched processes/ports with their project, and offer a choice when several servers are found. Guard asynchronous discovery results against a project switch. This needs a two-project runtime regression test.

### 5. Removing a saved API connection does not revoke a running daemon's inherited key — source-confirmed

`connections.ts:748` removes the saved record. The `connections:clear` handler does not restart or invalidate already running daemons. Their existing environment remains unchanged. A restart control exists in the store connections popup, but this is not immediate revocation.

**Change:** explain which running agents still hold access and implement a deliberate stop/restart or broker-level revocation flow. Do not present a removed credential as immediately inaccessible to existing processes.

### 6. Website release configuration is incomplete — reproduced

`npm run site:check` refuses to build because legal name, support email, security email and copyright holder remain TODOs in `site.config.json`. Raw source previews consequently show unresolved contact/footer tokens. This is a release blocker for the current checkout, not proof that any previously published deployment is broken.

**Change:** supply actual owner/contact values and check the rendered build. Do not bypass the guard or invent details.

### 7. Inner pages contradict availability and approval behaviour — rendered and source-confirmed

- Requirements says separate downloads are available and offers **Choose a download**, which leads to a page saying no public download exists.
- About says every edit waits for approval and has a **Nothing writes itself** promise. Security correctly explains that Auto edit and Full access allow writes without prompts.
- About counts three views, while Features describes Chat, Agents, Code and Thread. The current app also contains Station and Connections, which are scarcely explained by the website.
- Requirements says to have a compatible coding agent ready without identifying the actual OpenCode dependency used by the desktop startup code.

**Change:** use one release status and one verified capability list across inner pages. Explain the actual setup prerequisites and modes. Keep the homepage untouched.

## Visual assessment and recommended changes

These are design judgments, distinct from the bugs above. Preserve the app's dark navy/cobalt colours exactly.

| Area | Assessment | Recommended change |
| --- | --- | --- |
| Homepage | Strongest expression of the identity: illustrated Athena, sky, navy outlines, warm gold and clear large type. | Preserve as requested. Use it as the website reference. |
| About, Availability, Waitlist | The sanctuary/cauldron scene is darker, more muted and more mystical than the homepage. Repeating it makes several different pages feel interchangeable. | Prefer an existing bright workshop/library/path illustration if it fits; otherwise commission matching artwork. Match line weight, cream stone, clear blue sky and restrained gold. Do not replace imagery merely to increase image count. |
| Features banner | Bright workshop architecture is coherent with the homepage. | Keep. It is a useful reference for other inner-page artwork. |
| Security banner | Owl, shield and columns fit the illustration family and support the subject. | Keep. Use quieter document styling below it. |
| How it works artwork | The builder sculpture and mountain path fit the brand. | Keep; the steps need more attention than the images. |
| Requirements artwork | The Artemis/deer scene fits the palette but communicates little about computer readiness. | Lower priority: a matching desk/instrument scene would be more relevant; accurate requirements matter first. |
| Features layout | Eight equally prominent cards flatten the hierarchy and delay proof of the product. On mobile this becomes a long stack before the screenshot. | Lead with a current app capture and three key workflows: parallel work, edit review and preview. Group remaining capabilities into compact supporting rows. |
| Product screenshots | Features shows an older light app. The current desktop is dark and has additional navigation. The full-window screenshot is unreadable at phone width. | Capture the current dark app; keep its colours. Add focused crops and an accessible expand action, with captions explaining one concrete action per image. Update only inner pages. |
| How it works steps | Browser list numbers appear outside cards as well as the designed number badges. The introductory multi-agent pitch repeats material before getting to setup. | Remove duplicate visual numbering; make the real sequence prominent and pair steps with small current UI crops. |
| FAQ | Search and disclosure work. The heading treatment and very faded sanctuary image feel less coherent than the stronger product pages. | Retain search and categories. Simplify the heading and use either a crisp small illustration or a quiet background, rather than barely visible large artwork. |
| Availability | Truthful about being unfinished, but mostly a stop sign followed by another link. | Explain what an update includes and which capabilities are ready versus under development. Avoid invented launch dates or prices. |
| Waitlist | Straightforward form with consent and optional platform selection. Much of the adjacent copy repeats the hero. | Explain the benefit of joining and what happens after signup; make it a useful final step in the journey. Verify real submission delivery separately. |
| Security and documents | Large outlined cards and generous sections make a short technical page feel longer than needed. | Use narrower reading columns and clear subsections; reserve heavy cards for actionable content. |

Visual evidence: [About](screenshots/about-1440.png), [Features desktop](screenshots/features-1440.png), [Features mobile](screenshots/features-390.png), [How it works](screenshots/how-it-works-1440.png), [Waitlist](screenshots/waitlist-1440.png).

## Desktop improvements without changing colours

- **Make first use more directed.** Projects offers New agent, Add folder, New project and Watch your projects folder in the same initial experience. Give the empty state one clear starting action and distinguish a single project from a parent folder containing projects.
- **Explain Station at the point of entry.** The empty form is reasonably clear, but Station is a new concept alongside Workspace. A short subtitle such as “Build and manage stores” is more useful than repeated Station headings. Preserve its separate workspace behaviour.
- **Reduce Connections density.** The long provider catalogue and moving logo strip make account setup feel like browsing a marketplace. Put saved connections first; keep search prominent; provide category filters and Verified/Needs setup/Expired states. A stored field is not a verified integration.
- **Standardize provider marks.** Recognizable logos sit beside fallback initials such as GE, G( and RM. The fallback containing punctuation looks unfinished. Use a consistent neutral fallback mark and size; retain the existing colour scheme.
- **Improve hierarchy and readability through sizing and spacing.** Numerous helper labels are 10–12px. Increase essential instructions and account-state text selectively, simplify nested panel borders, and keep technical detail expandable. No palette change is necessary.
- **Make ongoing work understandable.** “24/7 management” is qualified as running only while Olympus is open; the implementation checks idle stores every five minutes. Show last check, next check and paused reasons instead of relying on the broad claim. This is expectation-setting, not a request to change the intended automation.

See [Station](screenshots/desktop-station.png), [Projects](screenshots/desktop-projects.png) and [Connections](screenshots/desktop-connections.png).

## Implementation order

1. Fix authentication status, session protection, effective permission display and connection revocation semantics.
2. Resolve website release details and contradictory inner-page claims.
3. Refresh inner-page app screenshots and mobile crops, preserving the desktop colours.
4. Restructure Features and setup steps; improve first-run and Connections hierarchy.
5. Replace only the mismatched inner-page artwork and simplify lower-priority document layouts.

For any later implementation, take a before/after homepage screenshot comparison because inner pages share CSS with it. Scope new rules to inner-page classes or stylesheets. Preserve the homepage markup, visual appearance and interactions, and preserve the app palette.
