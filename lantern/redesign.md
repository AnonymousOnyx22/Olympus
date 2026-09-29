# Olympus redesign - agent harness and project manager

## Superseded — Aegean Greek High-Tech theme

The neutral dark theme described below was replaced by the light "Aegean Greek High-Tech" theme. The
decisions, layout and implementation map below are kept unchanged as a record of that earlier redesign;
they no longer describe the current interface.

## Direction

Use the supplied BridgeMind screenshot as the visual and interaction reference: compact workspace navigation, a dominant agent transcript, a segmented Agent / Code / Thread control, and an optional live project panel. Keep Olympus branding and render actual OpenCode sessions and model information. Do not invent running Claude Code or Codex processes, credits, test results, or project health.

Olympus should answer three questions immediately: which project am I in, what is the agent doing, and what changed?

## Design decisions

- Neutral black-and-white interface. Background #0a0a0a, panels #111111, raised controls #191919, borders #303030, primary text #ededed, secondary text #a3a3a3.
- Retain subdued green for success/additions, red for errors/deletions, and amber for attention. Every state also has a label or symbol. No decorative project hues or indigo chrome.
- Use the existing Inter/Segoe UI stack for navigation and readable answers. Use JetBrains Mono/Cascadia Code for prompts, commands, paths, and tool activity. Main text 13-14px; secondary text 11-12px.
- Left-align content. Compact 32px navigation rows, 40-44px pane headers, quiet 1px borders, and restrained 8-12px panel corners. Remove the animated startup overlay and ornamental busy animation.
- Default to Agent. Thread is a readable view of the same session; it is not the multi-project grid.
- The right panel is Preview / Project context only. Do not reintroduce the removed right-side review panel. Pending edits open in the center with an obvious return action.
- Absorb project switching into the workspace tree. Keep the project library for searching, creating, watching, pinning, and organizing folders.

## Layout

```text
Olympus       project / session       [Agent | Code | Thread]    Git  Run  Approvals
+-------------------+-----------------------------------+-----------------------+
| Workspaces      + | Session header / model / status   | Preview | Project   - |
| > Project A       |                                   |                       |
|   Active session  | Prompt                            | Local browser preview |
|   Previous work   | Read / Edit / Bash activity       | or project details    |
| > Project B       | Tool output and inline diff       |                       |
| > General         | Agent response                    |                       |
|                   |                                   |                       |
| Manage projects   | Composer / model / queue / stop   |                       |
| Skills / status   | Optional shell terminal drawer    |                       |
+-------------------+-----------------------------------+-----------------------+
```

Both left navigation and the Code file explorer collapse independently and remember their state. A collapsed navigation rail retains expand, new session, and projects actions. The right panel closes completely and can be reopened from the header. On narrower windows it uses an overlay so the agent/editor remains usable. Each pane scrolls independently.

## Workspace and session behavior

- Group sessions under their project. Show actual cached sessions for previously visited workspaces; avoid implying unloaded projects have no history.
- New session belongs to the current project. General is an explicit workspace for conversations without a project.
- Opening a saved session selects its project before loading it. Active session, working directory, model, activity, and approval state remain visible.
- Preserve the concurrently developed per-project daemon backend. Switching workspaces keeps background agents running; show their real busy state in the workspace tree. Within a busy workspace, disable changing or deleting its active session. Scope permissions, prompts, queues, and terminals to their project.
- Agent and Thread share session state and composer draft. Switching views must not restart a run or discard pending approvals.
- Agent displays compact prompt lines, tool names/arguments, running/completed/failed status, expandable output, and real diff data when provided. Thread emphasizes the conversation while keeping tool activity discoverable.
- Permissions, errors, queued messages, model selection, cancellation, and retries remain operational. Never claim every provider runs locally or every edit requires approval when settings say otherwise.

## Project management

The project library retains search, sorting, list/grid views, watched folders, new-folder creation, pinning, reveal-in-file-manager, hide/remove, and missing-folder states. Default to the list view for scanning many projects. Project context shows the actual folder, detected stack, session count, and current agent state, with actions to manage projects or reveal the folder. No synthetic analytics or fabricated build status.

## Git and preview

Keep Git in the project header. Its menu shows branch, tracking branch, changed files, ahead/behind counts, commit message, Commit all changes, and Push. Commit and push remain separate explicit actions; saved repository changes are committed, and editor buffers must be saved first. Errors and progress remain visible. Ahead/behind uses locally known remote refs; Refresh does not fetch.

Run starts the detected project command. A development server opens the companion preview while the terminal remains accessible. Preview renders the actual localhost app with a URL field, reload, discovery, and an honest waiting/error state. The right panel never substitutes a fake dashboard for a project that has not started.

## Implementation map

| Area | Files |
| --- | --- |
| Theme, focus, typography, editor tokens | `tailwind.config.js`, `src/index.css`, `src/main.tsx` |
| Workspace state and session switching | `src/App.tsx` |
| Workspace tree and collapsed rail | `src/components/Sidebar.tsx` |
| Modes, project actions, approvals, Git | `src/components/WorkspaceBar.tsx`, `GitMenu.tsx` |
| Agent transcript and conversation | `src/components/ChatCanvas.tsx`, `AgentStatus.tsx` |
| Preview and project context | `src/components/ContextPanel.tsx`, `PreviewPanel.tsx` |
| Project library | `src/components/ProjectsPage.tsx` |
| Code, review, shell | `EditorWorkspace.tsx`, `DiffViewer.tsx`, `TerminalPanel.tsx` |

## Completion criteria

- [x] Neutral theme reaches main chrome, project library, model picker, transcript, editor, and terminal.
- [x] Workspace tree and both collapse controls work and persist.
- [x] Agent / Code / Thread work on the same active project and session.
- [x] Optional Preview / Project panel opens and closes without a persistent right rail.
- [x] Project management and header Git actions remain functional.
- [x] Approvals, errors, queued messages, and stop remain accessible.
- [x] Type checking and production build pass.
- [x] Rendered UI checked with real component state, including empty and populated sessions.
- [x] Navigation, collapse, mode switching, and project panel verified in an Electron smoke test.

## Deliberate limits

This redesign retains the existing OpenCode backend. Per-project daemons are supplied by the concurrent backend work and retained here. Native Claude Code/Codex CLI adapters, scheduling, and a task database require separate backend work. The UI must not present those features as implemented. Existing session histories remain managed by OpenCode; inactive workspace session caches are refreshed when opened.

## Implemented and verified

Implemented the neutral workspace shell, project/session tree, Agent / Code / Thread modes, compact tool activity with inline diffs, optional Preview / Project panel, terminal drawer, project-library styling, and header Git controls. New sessions now stay in the selected project. Agent and Thread share the same composer instance. Startup and busy-state ornamentation were removed.

Integrated the per-project API signatures introduced by the concurrent backend changes. Preserved background project activity and scoped permission replies, terminal creation, and queued messages by workspace. Monaco now selects the matching language worker; diff editor models are disposed after the editor detaches.

Verification completed:

- `npm run build`: TypeScript and production bundles pass.
- Hidden Electron smoke test with an isolated profile and fixture API: Agent default, populated transcript, real component rendering of tool diffs, Agent/Thread draft preservation, left sidebar collapse/expand, file explorer collapse/expand, context tabs and close/reopen, Git menu and push feedback, pending-edit review and return, project library, workspace switching, new-session project routing, and narrow-window overflow.
- Inspected screenshots of the agent workspace, Code view, Project context, project library, and narrow layout.
- Final smoke test reported no renderer errors. Live model execution and remote pushes were not exercised by this redesign test; earlier Git integration checks used temporary local repositories.

The reference is implemented with Olympus's actual OpenCode capabilities. The preview shows the user's running localhost app or an honest waiting state; it does not contain the reference screenshot's sample dashboard.
