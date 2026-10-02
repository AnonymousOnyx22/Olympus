# Olympus workspace and website interaction audit

1 October 2026. This audit covers the current local working copy, including changes made during the audit. It does not certify a published site or a live multi-agent session.

## Finding that caused the reported folder mismatch

The folder chip in an agent pane passed only the pane's project ID to `App.goToProject()`. The picker then called `switchSpace()`, which changed the focused project and sidebar title. It did not change that pane's `spaceId` or `sessionID`. The pane therefore stayed bound to EdgePicker after Clipforge was selected. The picker also said it would *move the conversation*, which the app's per-project daemon/session model does not support.

The pane picker now identifies the source session. Selecting a different folder starts that project's daemon, creates a replacement session there, opens it in the shared Workspace, and closes the old window. The previous conversation remains saved in its original project. The picker explains this before selection. Work in progress, queued prompts, and pending approvals must be cleared before changing a pane's folder. The ordinary single-chat project picker now describes project navigation accurately.

**Remaining validation:** a live Electron run with two real folders and a connected model should confirm that the replacement pane can read only its selected folder and that the old conversation can be reopened. This audit did not send prompts to a model or edit a real project.

## Website experience

| Area | Finding | Action |
| --- | --- | --- |
| Product understanding | The home page mentioned multiple projects, but its three pane example was static. The screenshot tour focused on Code, a task, and the project library, so the main Workspace interaction was hard to experience. | Added a scripted, responsive Workspace example on `app.html`; the home hero and multi-project section link to it. |
| Multiple agents | Visitors could not give separate agents tasks, add another pane, or change an individual pane's folder. | The example now supports independent conversations, task entry, adding/closing windows, and an app-style folder chip that opens a searchable project dialog. It explicitly says no model is connected. |
| App evidence | The screenshot tour uses captures from the Windows beta, but does not yet show a verified capture of several real agent panes at once. | Keep the tour and its capture disclosure. Add a genuine multi-agent capture after a live run if that workflow is ready to demonstrate. |
| FAQ navigation | Focusable links were inside an `aria-hidden` rail. | Removed `aria-hidden` and named the rail. |
| Home demo legibility | The activity indicator failed automated text contrast. Its fake time/token detail also implied live progress in a scripted demo. | Darkened the indicator and removed the invented progress detail. |
| Launch configuration | `site:check` refuses to build because legal name, support inbox, security inbox, and copyright holder are TODO. | Supply real approved values before publishing. The build gate is working as intended. |

## Verification

- `node audit/2026-10-01/interaction-audit.cjs`: 17 HTML pages at 1440px and 390px, 34 combinations. **0 detected issues** for local links and fragments, loaded images, horizontal overflow, page script exceptions, or automated WCAG 2 A/AA and 2.1 AA rules. The result is in `interaction-audit-results.json`.
- `node audit/2026-10-01/workspace-demo-check.cjs`: at 1440px and 390px, add agent, send task, open/search/close the folder dialog, restore focus, change folder, add an example folder, close agent, layout, script errors, and automated accessibility checks passed. Screenshots are in `screenshots/workspace-demo-*.png` and `screenshots/workspace-picker-*.png`.
- `npm run typecheck`: passed after a separate concurrent ProjectsPage change left two stale references; those references were corrected.
- `npm test -- --run`: 99 passed, 1 skipped.
- `npm run site:check`: intentionally fails on the four required configuration values above. No production build was made.

Automated accessibility does not replace keyboard and screen-reader use on real devices. The waitlist's actual submission and email delivery also require a deployed Netlify test; neither was claimed here. The scripted Workspace example demonstrates behavior; the running beta capture linked from the demo is evidence of the app interface.
