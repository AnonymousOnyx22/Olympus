# Website and workspace audit — completed code findings

Date: 1 October 2026. Scope: the 17 website pages, their interactive examples and signup flow, plus the reported desktop agent-folder workflow. Claude and Kilo were working in the same checkout; this report attributes only the changes and checks performed in this audit. No deployment or real signup was submitted.

## Findings and resolution

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Sending to, closing, or changing one example agent rebuilt the grid and erased unsent drafts in other panes. | Drafts now belong to each agent, survive renders, and clear only when sent or archived. Conversation scroll positions are retained. | Browser scenario: unrelated draft remains after another agent sends. |
| The demo claimed that previous conversations stayed saved, but discarded them. | Closing a window or changing folders saves its conversation and draft for the current visit. Saved conversations can be reopened below the Workspace. The picker explains the lifetime. | Browser scenario: reopen the original folder's draft and reopen a closed transcript. |
| Add agent silently selected a project. | Add agent opens the project picker, matching the desktop workflow. | Desktop/mobile workspace interaction checks. |
| General could be selected as a replacement pane destination, even though the Workspace excludes General sessions. The new window could disappear. | The agent-folder picker offers project folders only. General remains available through ordinary chat/project navigation. | Live Electron test with real daemons. |
| Published security headers prevented the home page's sample apps from being embedded. Earlier scans did not exercise the frames. | CSP `frame-ancestors` and X-Frame-Options now allow same-origin framing. External framing remains blocked. | All three embedded samples operated with both configured response headers applied. |
| The FAQ had inline styles, a script, and a submit handler rejected by its configured CSP. | Extracted them into `faq-page.css` and `faq-page.js`. Search Enter no longer navigates/reloads the page. | CSP event capture across the page matrix; search, empty results, clearing, Enter, and disclosure tests. |
| The waitlist could stay busy forever after a stalled network request, and a programmatic repeat submit could send duplicates. | Added a 15-second timeout, busy semantics, duplicate suppression, preserved input on failure, and retry. POST uses the static-site form endpoint; success uses the form's configured destination. | Mocked failure, retry, duplicate, success, and stalled-request scenarios. No email left the local test. |
| IPv6 and subdomain localhost previews were not included in the signup preview guard. | Added those local hosts. | Source review plus local-preview browser check. |
| Disabling JavaScript left a blank Workspace and an inert Add agent button. | Added an explanatory fallback and feature link; the button appears when its script initializes. | Browser context with JavaScript disabled. |
| FAQ/security copy promised every edit and command would require approval, conflicting with Auto edit and Full access. | The text now describes the actual three approval modes. | Compared with `buildOpencodeConfig()` in `electron/daemonManager.ts`. |
| App-page metadata promised views no longer demonstrated on that page. | The description now describes the multi-agent Workspace example that is present. | Source/content review. |
| Invalid saved sample data could permanently break the notes/planner demos on load. | Validate stored records and fall back to sample data when their shape is invalid. Long user-entered headings wrap. | Malformed-storage and 320px long-title browser scenarios. |
| The sample portfolio's open case-study dialog lacked an accessible name. | Linked the dialog to its displayed case-study heading. | Markup inspection; dialog open/close exercised in the embedded preview. |
| The page audit logged findings but returned a successful exit code. | It now exits unsuccessfully when findings remain. | Audit runner review. |

## Verification and artifacts

- **Website page scans:** `interaction-audit-results.json` covers all 17 pages at 1440px and 390px. No detected broken local links/fragments, failed images, horizontal overflow, page exceptions, or automated WCAG 2 A/AA and 2.1 AA violations at completion.
- **Deep browser checks:** all 11 scenarios in `deep-website-results.json` passed. These include an additional 17-page matrix at 320px and 768px with CSP violations collected, working embedded apps under CSP and X-Frame-Options, search, keyboard navigation, ordinary-motion navigation/back recovery, conversation state, signup handling, no-JavaScript behavior, and malformed saved data.
- **Workspace picker:** `workspace-demo-check.cjs` passed at 1440px and 390px, including an accessibility scan while the picker is open. Screenshots: `screenshots/workspace-demo-*.png` and `screenshots/workspace-picker-*.png`.
- **Live desktop:** `folder-switch-live-results.json` records seven passing checks using a compiled Electron app, isolated user data, two temporary projects, and actual agent daemons. Only the selected pane moved; the other pane remained; the old session remained in the source; the replacement session's directory matched the target; a cross-project session request was rejected; the window mapping persisted; General was absent from the pane-folder picker. Screenshot: `screenshots/folder-switch-live.png`.
- **Build:** `npm run build` passed, including TypeScript. `npm test`: 99 passed, 1 skipped. Website JavaScript syntax and `git diff --check` passed.
- **Lint:** no errors, 38 existing warnings, mainly React effect/ref/dependency rules. This was a website and folder-flow audit, not a rewrite of the desktop's React state architecture. Those warnings remain engineering follow-up work and are not represented as fixed here.

## Remaining inputs and external verification

`npm run site:check` still correctly refuses publication until these real values are supplied in `olympus-web/site.config.json`:

- `entity.legalName`
- `contact.supportEmail`
- `contact.securityEmail`
- `product.copyrightHolder`

The user was asked for these values; none were invented. Netlify Forms detection, a real deployed test submission, and mail delivery still require the deployed site's configuration. Mocked browser tests verify client behavior, not service delivery. No publication was requested or performed.

No model prompt was sent during the live Electron test. The test verifies session identity, directory binding, persistence, and request scoping; it does not certify model output or arbitrary tool behavior. Automated accessibility checks are not a substitute for a screen-reader session or real-device review. External fonts were blocked in the repeatable browser scans.

## Run again

From the repository root:

```powershell
node audit/2026-10-01/deep-website-audit.cjs
node audit/2026-10-01/workspace-demo-check.cjs
node audit/2026-10-01/interaction-audit.cjs
# After npm run build in lantern:
node audit/2026-10-01/folder-switch-live.cjs
```

The browser scripts use the local Playwright/axe installations recorded in their imports. The live desktop script creates isolated temporary projects and leaves their path in its results for inspection.
