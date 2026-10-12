# Kern

A desktop workspace that connects all your AI agents and models (Claude, GPT, Gemini, Kimi, Grok, Llama,
local models and more) so you can work on separate projects at the same time, one window per chat.
Kern is not an agent itself.

```
app/    The desktop app (Electron, React, TypeScript). See app/README.md
website/    The marketing site (static HTML/CSS/JS). See website/README.md
marketing/  A free Instagram agent: plans, schedules and posts content and handles comments. See marketing/README.md
.github/    CI for the app
```

Verify the app: `cd app && npx tsc --noEmit -p . && npx vitest run && npm run build`.

Kern is proprietary; see `app/LICENSE`. Third-party notices are in `app/NOTICE.md`.
