# Kern website

Static site: HTML, three stylesheets and a few small scripts. No framework and no third-party
requests (system fonts, no analytics, no cookies).

```
build.mjs             Generates every *.html page from one shared header, footer and page shell
*.html                Generated pages (index, features, models, agents, projects, connections,
                      how-it-works, requirements, faq, security, privacy, changelog, about, 404)
css/styles.css        Tokens copied from the app (charcoal surfaces, hairline borders, Segoe UI),
                      navigation, buttons, scroll animations, dot-grid masks
css/connections.css   Replica of the app's Connections page and the "what each project receives" panel
css/demos.css         Model picker, diff review, approval modes and projects library demos
js/site.js            Header (hide on scroll, progress bar), dropdown nav, scroll reveal, step highlight,
                      button and card pointer effects, home page app preview
js/dots.js            Violet dot-grid background: dots sized by an animated brightness field, 8 s loop
js/connections.js     Interactive Connections page (search, filters, save, check, per-project access)
js/connections-data.js  The same 21 providers the app lists. Regenerate it if the app's list changes
js/demos.js           Model picker, diff review, approval modes, projects library
js/agents-loop.js     The four home page agent windows: always working, three glowing thinking dots
assets/kern-mark.svg  Logo and favicon
```

Edit page content in `build.mjs`, then run `node build.mjs`. Tests: `npm install`, `npx playwright install`, then `npm test` runs, in real browser engines:
- the whole site in Chromium, Firefox and WebKit with a mouse (every page, hover, scroll, nav and every demo);
- iPhone and iPad profiles in WebKit and a Pixel profile in Chromium, with touch input and no hover;
- an axe accessibility audit of every page on desktop and on a phone;
- reduced motion, and JavaScript switched off. CI runs it on Linux, macOS and Windows and checks the generated pages are up to date. Preview with `npx --yes serve .` or open
`index.html` directly.

Kern is not publicly distributed, so the site has no download, pricing or waitlist. Add them when that
is true. All demo data is sample data. Animations are CSS transitions where the user can interrupt them,
the replaying scroll reveal is toggled by `IntersectionObserver`, and everything respects
`prefers-reduced-motion`.
