# Third-Party Notices

Olympus is proprietary and closed source (see `LICENSE`). It bundles the
third-party components listed below, each under its own licence. Those licences
are separate from Olympus's terms and are not restricted by them.

## Bundled at runtime

| Component | Licence | Notes |
| --- | --- | --- |
| [Electron](https://electronjs.org) (incl. Chromium, V8, Node.js) | MIT | The desktop shell. Chromium is BSD-licensed; V8 is BSD; Node.js is MIT with additional notices. Electron's `LICENSE` file must ship in the distribution. |
| [React](https://react.dev) / [React DOM](https://react.dev) | MIT | Renderer UI. |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | MIT | Diff/code viewer. The MIT licence permits modification; Olympus themes the editor but does not modify its source. Attribution must be retained. |
| [xterm.js](https://xtermjs.org) (`@xterm/xterm`, `@xterm/addon-fit`) | MIT | Interactive terminal. |
| [Tailwind CSS](https://tailwindcss.com) | MIT | Utility CSS. Compiled into the stylesheet; no runtime component. |
| [framer-motion](https://www.framer.com/motion/) | MIT | UI animation. |
| [react-markdown](https://github.com/remarkjs/react-markdown) / [remark-gfm](https://github.com/remarkjs/remark-gfm) | MIT | Message rendering. |
| [simple-icons](https://simpleicons.org) | CC0-1.0 | Icon path data. |
| [diff](https://github.com/kpdecker/jsdiff) | BSD-3-Clause / Apache-2.0 | Diff computation. |

## Separate tool, not bundled

| Component | Licence | Notes |
| --- | --- | --- |
| [opencode](https://github.com/sst/opencode) | MIT | The coding agent Olympus drives. It is a **separate, independently licensed tool** that Olympus launches as an external process (`opencode serve`); none of its source is included in the Olympus distribution. Olympus is not affiliated with, endorsed by, or a product of the opencode project. Its licence governs it, and users install it under its own terms. |

## Development-only

TypeScript, Vite, Vitest, ESLint, electron-builder, Tailwind, PostCSS,
Autoprefixer, and related tooling — all MIT or equivalent, not shipped to users.

## Attribution obligations

Several of these licences (notably MIT and BSD) require the copyright notice
and permission text to be retained in redistributions. For an application
bundle distributed as a compiled `.app`/`.exe`, that means electron-builder's
`appLicense` output plus this file must remain reachable from the shipped
product. Do not strip them.
