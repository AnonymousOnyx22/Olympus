# Kern

A desktop workspace that connects all your AI agents and models (Claude, GPT, Gemini, Kimi, Grok, Llama,
local models and more) so you can work on separate projects at the same time, one window per chat.
Kern is not an agent itself.

```
lantern/    The desktop app (Electron, React, TypeScript). See lantern/README.md
website/    The marketing site (static HTML/CSS/JS). See website/README.md
.github/    CI for the app
```

Verify the app: `cd lantern && npx tsc --noEmit -p . && npx vitest run && npm run build`.

Kern is proprietary; see `lantern/LICENSE`. Third-party notices are in `lantern/NOTICE.md`.
