// Generates the site's HTML pages. Run `node build.mjs` from this folder (Node 18+, no dependencies).
// The shared header, footer and page shell live here once; each page's content is below.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const MARK = (s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M9 7v26M30 7 17 20l13 13" stroke="#f2f2f2" stroke-width="4"/><path d="M9 20h8" stroke="#f2f2f2" stroke-width="4"/></svg>`
const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
const ICONS = {
  features: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  models: 'M8 8h8v8H8V8Zm2-5v3m4-3v3m-4 12v3m4-3v3M3 10h3m-3 4h3m12-4h3m-3 4h3',
  agents: 'M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  connections: 'M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v4',
  how: 'M5 12h14m-6-6 6 6-6 6',
  requirements: 'm5 12 4 4 10-10',
  faq: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  changelog: 'M12 8v5l3 2m6-3a9 9 0 1 1-3-6.7',
  security: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z',
  privacy: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  about: 'M12 11v5m0-8h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0',
}
const NAV = [
  { label: 'Product', items: [
    ['features.html', 'Features', 'Everything around your agents', 'features'],
    ['models.html', 'Models', 'Claude, GPT, Kimi, Grok and more', 'models'],
    ['agents.html', 'Agents and approvals', 'Review every change', 'agents'],
    ['projects.html', 'Projects', 'Many projects, one window', 'projects'],
    ['connections.html', 'Connections', 'Keys, handled once', 'connections'],
    ['how-it-works.html', 'How it works', 'From prompt to accepted change', 'how'],
  ] },
  { label: 'Resources', items: [
    ['requirements.html', 'Requirements', 'What Kern needs', 'requirements'],
    ['faq.html', 'FAQ', 'Short answers', 'faq'],
    ['changelog.html', 'Changelog', 'What is in this build', 'changelog'],
  ] },
  { label: 'Trust', items: [
    ['security.html', 'Security', 'How it stays on your machine', 'security'],
    ['privacy.html', 'Privacy', 'What it collects (nothing)', 'privacy'],
    ['about.html', 'About', 'What Kern is for', 'about'],
  ] },
]
const CHEVRON = '<svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg>'
const ARROW = '<span class="arrow" aria-hidden="true">&rarr;</span>'

function header(file) {
  const groups = NAV.map((g) => {
    const current = g.items.some((i) => i[0] === file)
    const items = g.items.map(([href, title, desc, ic]) => `<a href="${href}" role="menuitem"${href === file ? ' aria-current="page"' : ''}><span class="menu__icon">${icon(ICONS[ic])}</span><strong>${title}</strong><small>${desc}</small></a>`).join('')
    return `<div class="nav__group${current ? ' is-current' : ''}"><button type="button" class="nav__link" aria-haspopup="true" aria-expanded="false">${g.label}${CHEVRON}</button><div class="menu" role="menu" aria-label="${g.label}">${items}</div></div>`
  }).join('')
  return `<header class="site" data-site><div class="wrap site__row">
<a class="lockup" href="index.html" aria-label="Kern, home">${MARK()}Kern</a>
<nav class="nav" id="site-nav" aria-label="Primary" data-open="false"><span class="nav__ind" aria-hidden="true"></span>${groups}</nav>
<a class="btn btn--primary btn--sm site__cta" href="requirements.html">Get started ${ARROW}</a>
<button class="navtoggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span><span></span><span></span></button>
</div><div class="site__progress" aria-hidden="true"></div></header>`
}

function footer() {
  const col = (g) => `<div><p class="foot__h">${g.label}</p><ul>${g.items.map(([href, title]) => `<li><a href="${href}">${title}</a></li>`).join('')}</ul></div>`
  return `<footer class="foot"><div class="wrap"><div class="foot__cols">
<div class="foot__brand"><a class="lockup" href="index.html">${MARK(22)}Kern</a><p>One workspace for every AI agent. Connect the models you use and work on separate projects at the same time.</p></div>
${NAV.map(col).join('')}
</div><p class="foot__legal">&copy; 2026 Nick. All rights reserved. Kern is in private development and is not publicly distributed.</p></div></footer>`
}

function page({ file, title, description, body, scripts = [] }) {
  const tags = ['js/dots.js', ...scripts, 'js/site.js'].map((s) => `<script src="${s}" defer></script>`).join('\n')
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#181818">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kern">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="assets/kern-mark.svg">
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/connections.css">
<link rel="stylesheet" href="css/demos.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(file)}
<main id="main">
${body}
</main>
${footer()}
${tags}
</body>
</html>
`
}

const head = (eyebrow, h1, lede) => `<section class="page-head"><canvas class="dots dots--head" data-cell="14" aria-hidden="true"></canvas><div class="wrap"><p class="eyebrow">${eyebrow}</p><h1 class="h1-page">${h1}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div></section>`
const cta = (h, sub, a = ['requirements.html', 'Check requirements'], b = ['how-it-works.html', 'See how it works']) => `<section class="cta"><canvas class="dots dots--cta" data-cell="18" aria-hidden="true"></canvas><div class="wrap"><h2 data-reveal>${h}</h2>${sub ? `<p class="lede" data-reveal>${sub}</p>` : ''}<div class="hero__actions" data-reveal><a class="btn btn--primary" href="${a[0]}">${a[1]} ${ARROW}</a><a class="btn" href="${b[0]}">${b[1]}</a></div></div></section>`
const card = (n, h, p, href) => `${href ? `<a class="card" href="${href}" data-reveal>` : '<div class="card" data-reveal>'}${n ? `<span class="card__n">${n}</span>` : ''}<h3>${h}</h3><p>${p}</p>${href ? `<span class="link">Explore ${ARROW}</span></a>` : '</div>'}`

const dataSrc = fs.readFileSync(path.join(here, 'js', 'connections-data.js'), 'utf8')
const providers = JSON.parse(dataSrc.slice(dataSrc.indexOf('[')))
// Logo strip. Four identical sets scroll left by exactly two sets, so the loop is seamless at any width
// and nothing (hover included) pauses it. GPT and Grok have no mark in simple-icons, so they get a monogram.
const MODEL_ICONS = JSON.parse(fs.readFileSync(path.join(here, 'assets', 'model-icons.json'), 'utf8')).icons
const MODELS = ['Claude', 'GPT', 'Gemini', 'Kimi', 'Grok', 'Llama', 'Mistral', 'Qwen', 'Ollama', 'LM Studio', 'OpenRouter', 'Hugging Face']
const MONO = { GPT: 'GP', Grok: 'Gr' }
const modelMark = (m) => MODEL_ICONS[m]
  ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${MODEL_ICONS[m]}"/></svg>`
  : `<span class="marquee__mono" aria-hidden="true">${MONO[m] || m.slice(0, 2)}</span>`
const marquee = (() => {
  const set = (hidden) => `<div class="marquee__set"${hidden ? ' aria-hidden="true"' : ''}>${MODELS.map((m) => `<span class="marquee__item">${modelMark(m)}${m}</span>`).join('')}</div>`
  return `<div class="marquee" aria-label="Models and tools you can connect"><div class="marquee__track">${set(false)}${set(true)}${set(true)}${set(true)}</div></div>`
})()

const preview = `<div class="app" aria-label="Illustration of the Kern window with sample data">
<div class="app__side" role="tablist" aria-orientation="vertical" aria-label="Kern sections">
<div class="app__brand">${MARK(19)}Kern</div>
<div class="app__new" aria-hidden="true"><span>+</span> New agent</div>
<div class="app__dest">
<button type="button" role="tab" data-tab="agents" aria-selected="true" id="tab-agents" aria-controls="pane-agents">Agents</button>
<button type="button" role="tab" data-tab="projects" aria-selected="false" tabindex="-1" id="tab-projects" aria-controls="pane-projects">Projects</button>
<button type="button" role="tab" data-tab="connections" aria-selected="false" tabindex="-1" id="tab-connections" aria-controls="pane-connections">Connections</button>
</div>
<p class="app__label">Projects &middot; 3</p>
<div class="app__proj is-on"><span class="dot dot--live"></span>studio</div>
<div class="app__proj"><span class="dot"></span>notes</div>
<div class="app__proj"><span class="dot dot--warn"></span>api</div>
<div class="app__status"><span class="dot"></span>Agents working</div>
</div>
<div class="app__main">
<div class="pane is-on" data-pane="agents" id="pane-agents" role="tabpanel" aria-labelledby="tab-agents"><div class="agents">
<article class="agent" data-agent="claude"><div class="agent__head"><span data-mark><span class="dot dot--live"></span></span><span data-title>Homepage headline</span><small>studio &middot; Claude</small></div><div class="agent__body" data-body>
<p class="you">Give the home page a clear, welcoming headline.</p>
<p>I'll update the heading and the supporting copy. You can review the change before it is applied.</p>
<div class="tool"><span aria-hidden="true">&#9998;</span> Edit src/Hero.tsx</div>
</div></article>
<article class="agent" data-agent="gpt"><div class="agent__head"><span data-mark><span class="dot dot--live"></span></span><span data-title>Note search</span><small>notes &middot; GPT</small></div><div class="agent__body" data-body>
<p class="you">Add search to the notes list.</p>
<div class="tool"><span aria-hidden="true">&#9654;</span> npm test</div>
<p>All 14 tests pass. Search filters by title and body, ignoring case.</p>
</div></article>
<article class="agent" data-agent="grok"><div class="agent__head"><span data-mark><span class="dot dot--live"></span></span><span data-title>Request logging</span><small>api &middot; Grok</small></div><div class="agent__body" data-body>
<p class="you">Log every request to the server.</p>
<p>I want to run a shell command to install a package.</p>
<div class="tool"><span aria-hidden="true">$</span> npm install morgan</div>
</div></article>
<article class="agent" data-agent="kimi"><div class="agent__head"><span data-mark><span class="dot dot--live"></span></span><span data-title>README pass</span><small>studio &middot; Kimi</small></div><div class="agent__body" data-body>
<p class="you">Tidy the README.</p>
<p>Done. I shortened the intro, fixed the setup steps and added a section on running the tests.</p>
</div></article>
</div></div>
<div class="pane" data-pane="projects" id="pane-projects" role="tabpanel" aria-labelledby="tab-projects"><div class="rows">
<div class="row"><span>studio</span><span>2 agents working</span><small>~/work/studio &middot; main</small></div>
<div class="row"><span>notes</span><span>Idle</span><small>~/work/notes &middot; main</small></div>
<div class="row"><span>api</span><span>Needs approval</span><small>~/work/api &middot; feature/auth</small></div>
</div><p class="note">Search, sort, pin and watch folders. Missing folders are hidden until they come back.</p></div>
<div class="pane pane--flush" data-pane="connections" id="pane-connections" role="tabpanel" aria-labelledby="tab-connections"><div class="cx" data-connections><noscript><p style="padding:24px">Connections: save keys for AI models, Stripe, email, analytics, storage, hosting and Figma, and choose which projects get each one. Turn on JavaScript to try it.</p></noscript></div></div>
</div></div>`

const solo = `<div class="app app--solo" aria-label="Kern Connections page with sample data"><div class="app__side"><div class="app__brand">${MARK(19)}Kern</div><div class="app__new" aria-hidden="true"><span>+</span> New agent</div><div class="app__dest" aria-hidden="true"><button type="button" tabindex="-1">Agents</button><button type="button" tabindex="-1">Projects</button><button type="button" tabindex="-1" aria-selected="true">Connections</button></div><p class="app__label">Projects &middot; 3</p><div class="app__proj is-on"><span class="dot dot--live"></span>studio</div><div class="app__proj"><span class="dot"></span>notes</div><div class="app__proj"><span class="dot dot--warn"></span>api</div><div class="app__status"><span class="dot"></span>Ready</div></div><div class="app__main"><div class="cx" data-connections data-env="#env"><noscript><p style="padding:24px">Turn on JavaScript to try the Connections page.</p></noscript></div></div></div>`

const pages = []

// ---------- Home ----------
pages.push({
  file: 'index.html',
  title: 'Kern, one workspace for every AI agent',
  description: 'Kern is a desktop app that connects all your AI agents and models, Claude, GPT, Kimi, Grok, Llama and local models, so you can work on separate projects at the same time.',
  scripts: ['js/connections-data.js', 'js/connections.js', 'js/agents-loop.js'],
  body: `<section class="hero"><canvas class="dots dots--hero" data-cell="17" aria-hidden="true"></canvas><div class="wrap">
<p class="status-pill"><span class="dot dot--warn"></span>In private development</p>
<h1>Every agent. One workspace.</h1>
<p class="hero__lede">Kern is the app you connect all your AI agents to. Claude, GPT, Gemini, Kimi, Grok, Llama and your own local models, side by side, each working on a different project at the same time.</p>
<div class="hero__actions"><a class="btn btn--primary" href="how-it-works.html">See how it works ${ARROW}</a><a class="btn" href="models.html">Connect your models</a></div>
<p class="hero__meta">Windows, macOS and Linux &middot; No account &middot; Kern is not an AI itself</p>
</div></section>
${marquee}
<section class="section--tight"><div class="wrap" data-reveal="scale">${preview}<p class="note">Sample data. Pick a section, accept the edit, or open Connections and save a key. Try a Stripe key that starts with sk_test_, or one that says bad.</p></div></section>
<section class="section"><div class="wrap">
<div class="sec__head" data-reveal><p class="eyebrow">Not another agent</p><h2>The place all of them plug into.</h2><p class="lede">Every AI tool wants to be the one window you live in. Kern doesn't compete with them. It is the workspace around them, so you can use the right model for each job and keep them all in view.</p></div>
<div class="grid grid--3">
${card('01', 'Bring any model', 'Claude, GPT, Gemini, Kimi, Grok, Llama, Mistral, or a model running on your own computer. Pick one per window and switch whenever you like.', 'models.html')}
${card('02', 'Many agents at once', 'Every conversation is its own window. Run several side by side and watch which are working, waiting or done.', 'agents.html')}
${card('03', 'Separate projects', 'Each window belongs to a project folder. Work on your site, your API and your app in the same workspace, at the same time.', 'projects.html')}
</div></div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">In control</p><h2>You approve what gets written.</h2><p class="lede">Edits stop in a diff until you accept them, and shell commands ask first. Choose how strict each agent is, and keep your keys in one place instead of pasting them into chats.</p></div>
<div class="hero__actions" data-reveal><a class="btn" href="agents.html">Agents and approvals ${ARROW}</a><a class="btn" href="connections.html">Connections ${ARROW}</a></div></div></section>
${cta('One app. Every agent you use.', 'Kern is in private development and is not publicly available yet. Here is what it needs and what it does.')}`,
})

// ---------- Features ----------
pages.push({
  file: 'features.html',
  title: 'Features | Kern',
  description: 'Connect every model, run many agents at once on separate projects, review every change, and keep your keys in one place.',
  body: `${head('Features', 'Everything around your agents.', 'Kern is not an agent. It is the workspace you connect them to, and the controls you want around them.')}
<section class="section"><div class="wrap"><h2 class="sr-only">All features</h2><div class="grid grid--3">
${card('', 'Every model, one app', 'Connect Claude, GPT, Gemini, Kimi, Grok, Llama, Mistral and local models. Different windows can use different models.', 'models.html')}
${card('', 'Many windows at once', 'Each conversation is its own window in a grid, with streamed reasoning, expandable tool calls, inline diffs and the live todo list.', 'agents.html')}
${card('', 'Separate projects', 'A library of your folders with search, sort, list or grid, pins and watched folders. Each window belongs to one project.', 'projects.html')}
${card('', 'Reviewable edits', 'Edits stop in a diff viewer and nothing is written until you accept. Reject with a reason and the agent sees it.', 'agents.html')}
${card('', 'Approval modes', 'Ask for approval, approve for me (only asks about actions that look unsafe) or full access. Set per agent from the header.', 'agents.html')}
${card('', 'Code view', 'A file explorer and the Monaco editor for the focused project, a real terminal, and a live preview of your dev server.', 'how-it-works.html')}
${card('', 'Git in the header', 'Branch, changed files, and ahead or behind counts. Commit and push are separate, explicit actions.', 'how-it-works.html')}
${card('', 'Local models', 'Kern finds Ollama, LM Studio, vLLM and llama.cpp on your computer. Add any OpenAI compatible server on this machine.', 'models.html')}
${card('', 'Connections', 'Save keys once for AI models, Stripe, email, analytics, storage, hosting and Figma. Unchecked projects never receive a key.', 'connections.html')}
</div></div></section>
${cta('See it in motion.', 'The pages in the Product menu are interactive: pick a model, review a diff, save a key.', ['models.html', 'Try the model picker'], ['agents.html', 'Review a change'])}`,
})

// ---------- Models ----------
pages.push({
  file: 'models.html',
  title: 'Models | Kern',
  description: 'Connect Claude, GPT, Gemini, Kimi, Grok, Llama, Mistral and local models to one workspace and pick a model per window.',
  scripts: ['js/demos.js'],
  body: `${head('Models', 'Connect them all.', 'Kern has no model of its own. You plug in the ones you use, and pick a different one for each window.')}
<section class="section"><div class="wrap"><h2 class="sr-only">Three ways to connect a model</h2>
<div class="grid grid--3">
${card('01', 'On your computer', 'Kern finds Ollama, LM Studio, vLLM and llama.cpp running on this machine and lists what each has loaded. You can add your own OpenAI compatible server too; only this computer\'s addresses are accepted.')}
${card('02', 'With a key', 'Save a key under Connections for Google Gemini, Mistral, Hugging Face, OpenCode Zen or OpenRouter. OpenRouter is one key for many models, including Kimi, Grok and Llama.')}
${card('03', 'With tools you have', 'Already use the Claude or Codex command line tools? Kern bridges to them locally, so Claude and GPT models are a click away. Providers you configured elsewhere appear too.')}
</div>
<div class="sec__head" style="margin-top:72px" data-reveal><p class="eyebrow">Try it</p><h2>One window. Any model.</h2><p class="lede">Open the picker and switch. The conversation, the project and every other window stay exactly as they are.</p></div>
<div data-modelpicker data-reveal="scale"></div>
<p class="note">Sample list. What you see in the app depends on what you have connected.</p>
</div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">Why it matters</p><h2>Use the right model for the job.</h2></div>
<div class="grid grid--2">
${card('', 'Compare without switching apps', 'Put the same task in two windows with two models and see which does it better, side by side.')}
${card('', 'Keep going when one is down', 'Rate limited or offline? Open another window on the same project with a different model.')}
${card('', 'Match cost to the task', 'Use a local or cheap model for routine edits and a frontier model for the hard problem.')}
${card('', 'Not locked in', 'Your projects, keys and conversations live on your computer, not with any one provider.')}
</div></div></section>
${cta('Bring the models you already use.', '', ['connections.html', 'Connect a key'], ['requirements.html', 'Requirements'])}`,
})

// ---------- Agents ----------
pages.push({
  file: 'agents.html',
  title: 'Agents and approvals | Kern',
  description: 'Run many agents side by side, review every edit in a diff, and choose how much each agent may do without asking.',
  scripts: ['js/demos.js'],
  body: `${head('Agents and approvals', 'You stay in charge.', 'Agents propose. You decide. Every window shows what its agent is doing and waits where you want it to.')}
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">Review</p><h2>Nothing is written until you accept.</h2><p class="lede">Edits pause in a diff. Accept to write them to disk, or reject and tell the agent why. Try it.</p></div>
<div class="dv" data-diff data-reveal="scale">
<div class="dv__head"><span>src/Hero.tsx</span><span>+2 &minus;2</span></div>
<div class="dv__code" aria-label="Proposed change">
<div class="dv__line"><i>11</i><b></b><span>  return (</span></div>
<div class="dv__line"><i>12</i><b></b><span>    &lt;section className="hero"&gt;</span></div>
<div class="dv__line del"><i>13</i><b>&minus;</b><span>      &lt;h1&gt;Welcome to my website&lt;/h1&gt;</span></div>
<div class="dv__line del"><i>14</i><b>&minus;</b><span>      &lt;p&gt;Stuff I have made.&lt;/p&gt;</span></div>
<div class="dv__line add"><i>13</i><b>+</b><span>      &lt;h1&gt;Design that gets out of the way&lt;/h1&gt;</span></div>
<div class="dv__line add"><i>14</i><b>+</b><span>      &lt;p&gt;Small studio. Clear work.&lt;/p&gt;</span></div>
<div class="dv__line"><i>15</i><b></b><span>    &lt;/section&gt;</span></div>
</div>
<div class="dv__bar"><span data-status role="status">1 edit waiting for review</span><div class="dv__actions"><input class="dv__reason" data-reason type="text" placeholder="Optional: tell the agent why you're rejecting…" aria-label="Reason for rejecting"><button type="button" class="mini" data-reject>Reject</button><button type="button" class="mini mini--solid" data-accept>Accept</button><button type="button" class="mini" data-reset hidden>Try again</button></div></div>
</div></div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">Approval modes</p><h2>Decide how much it may do alone.</h2><p class="lede">Pick a mode, then run the same three actions. Notice what stops and what doesn't.</p></div>
<div data-modes data-reveal>
<div class="seg" role="group" aria-label="Approval mode"><button type="button" data-mode="ask" aria-pressed="true">Ask for approval</button><button type="button" data-mode="edit" aria-pressed="false">Approve for me</button><button type="button" data-mode="bypass" aria-pressed="false">Full access</button></div>
<p class="modeinfo" data-info></p>
<button type="button" class="btn btn--primary run" data-run>Run the task ${ARROW}</button>
<ul class="tl" data-tl aria-live="polite"></ul>
</div></div></section>
<section class="section"><div class="wrap"><h2 class="sr-only">More about agents</h2><div class="grid grid--3">
${card('', 'A window per conversation', 'Open as many as your machine can handle. Each shows streamed reasoning, tool calls you can expand and the live todo list.')}
${card('', 'Queue the next message', 'Add another message while an agent is working. It goes out when the agent is ready, and you can remove it before then.')}
${card('', 'Stop and recover', 'Stop any agent from its header. If one fails partway, a Continue button picks the work back up.')}
</div></div></section>
${cta('Many agents. One set of rules.', '', ['projects.html', 'Projects'], ['connections.html', 'Connections'])}`,
})

// ---------- Projects ----------
pages.push({
  file: 'projects.html',
  title: 'Projects | Kern',
  description: 'A library of your project folders. Search, sort, pin and watch folders, and run a separate agent in each at the same time.',
  scripts: ['js/demos.js'],
  body: `${head('Projects', 'Many projects, one window.', 'Every window belongs to a project folder. Keep all of them in one library and jump between them without stopping anything.')}
<section class="section"><div class="wrap" data-library>
<div class="lib__bar" data-reveal>
<label class="lib__search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input data-q type="search" placeholder="Search name, path or stack" aria-label="Search projects" autocomplete="off"></label>
<select class="mini" data-sort aria-label="Sort"><option value="recent">Recently opened</option><option value="name">Name</option></select>
<button type="button" class="mini" data-layout="list" aria-pressed="true">List</button><button type="button" class="mini" data-layout="grid" aria-pressed="false">Grid</button>
<button type="button" class="mini" data-missing aria-pressed="false">Simulate a missing folder</button>
</div>
<div data-list aria-live="polite"></div>
<p class="note">Sample projects. Pin one to keep it at the top.</p>
</div></section>
<section class="section"><div class="wrap"><h2 class="sr-only">More about projects</h2><div class="grid grid--3">
${card('', 'Watched folders', 'Point Kern at a parent folder and every project inside it shows up on its own.')}
${card('', 'Honest about missing folders', 'If a folder is moved or deleted, its project is hidden, not shown broken. It returns by itself if the folder does.')}
${card('', 'Create and organise', 'Start a new project, pin favourites, reveal a folder in your file manager, or hide a project you are done with.')}
</div></div></section>
${cta('Work on everything at once.', '', ['agents.html', 'Agents and approvals'], ['how-it-works.html', 'How it works'])}`,
})

// ---------- Connections ----------
const byCat = new Map()
for (const p of providers) { if (!byCat.has(p.category)) byCat.set(p.category, []); byCat.get(p.category).push(p) }
const tested = providers.filter((p) => p.check).map((p) => p.name)
const library = [...byCat].map(([cat, list]) => `<tr><th scope="row">${cat}</th><td>${list.map((p) => p.name).join(', ')}</td></tr>`).join('')
pages.push({
  file: 'connections.html',
  title: 'Connections | Kern',
  description: 'Save keys for AI models, Stripe, email, analytics, storage and hosting once, test them, and choose which projects get each one.',
  scripts: ['js/connections-data.js', 'js/connections.js'],
  body: `${head('Connections', 'Keys, handled once.', 'Save an API key a single time, let Kern test it, and decide which projects get it. This is the real page running on sample data, and it is all clickable.')}
<section class="section--tight"><div class="wrap" data-reveal="scale">${solo}<p class="try">Try it: open Stripe and paste a key starting with sk_test_, then check a project box off. A key that says bad, or is too short, fails the check.</p></div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">What each project receives</p><h2>Only what you allow.</h2><p class="lede">Every project gets the connections you have allowed for it, as environment variables. Toggle the boxes above and watch these change. Only the names appear here; the values never show up in a chat.</p></div><div class="envgrid" id="env" aria-live="polite" data-reveal></div></div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">How it works</p><h2>From a pasted key to a working project.</h2></div><div class="steps">
<div class="step" data-reveal><div><h3>Encrypted on this computer</h3><p>Secret values are encrypted with your operating system's own secret storage: DPAPI on Windows, Keychain on macOS, libsecret on Linux. They are only decrypted inside the app's main process.</p></div></div>
<div class="step" data-reveal><div><h3>Tested where possible</h3><p>Saving runs a real check against the service for ${tested.join(', ')}. The rest are saved but never claimed to work: they show "Saved, no test". A failed check says what was rejected, and the result is dropped the moment a value changes so it can never describe stale input.</p></div></div>
<div class="step" data-reveal><div><h3>Allowed per project</h3><p>Every project gets each saved connection unless you uncheck it on that connection's page. Unchecked projects get nothing. A running agent picks up the change the next time it starts.</p></div></div>
<div class="step" data-reveal><div><h3>The model never sees the value</h3><p>Generated code reads <code>process.env.STRIPE_SECRET_KEY</code>. The agent uses the variable; the raw key is not part of the conversation, so a model provider never receives it from Kern.</p></div></div>
</div><p class="note">One exception: if you use the Claude or Codex command line tools as a model, their local bridge receives every saved connection, whatever the per project boxes say.</p></div></section>
<section class="section"><div class="wrap"><div class="sec__head" data-reveal><p class="eyebrow">The library</p><h2>${providers.length} services, ready to connect.</h2></div><table data-reveal><tbody>${library}</tbody></table></div></section>
${cta('Keys stay put. Projects get what they need.', '', ['models.html', 'Connect models'], ['security.html', 'How it stays secure'])}`,
})

// ---------- How it works ----------
pages.push({
  file: 'how-it-works.html',
  title: 'How it works | Kern',
  description: 'Add projects, connect your models, open a window per task and review every change before it is written.',
  body: `${head('How it works', 'From prompt to accepted change.', 'Kern is the workspace around your agents. Here is a normal session, start to finish.')}
<section class="section"><div class="wrap"><h2 class="sr-only">The steps</h2><div class="steps">
<div class="step" data-reveal><div><h3>Add your projects</h3><p>Point Kern at the folders you work in, or let it watch a parent folder. Each project appears in the sidebar and in the Projects page.</p></div></div>
<div class="step" data-reveal><div><h3>Connect your models</h3><p>Models on your computer are found automatically. Add keys for hosted ones under Connections, or bridge to the Claude and Codex command line tools you already use.</p></div></div>
<div class="step" data-reveal><div><h3>Open a window for each task</h3><p>Start a new agent, choose its project and pick a model for that window. Open as many as you want. Each is its own conversation.</p></div></div>
<div class="step" data-reveal><div><h3>Work on separate things at the same time</h3><p>Follow reasoning and tool calls as they stream in, queue another message while an agent works, and watch the sidebar for which projects are busy or waiting on you.</p></div></div>
<div class="step" data-reveal><div><h3>Review before anything is written</h3><p>Edits pause in the diff viewer. Accept to write them to disk, or reject with a reason. Shell commands wait for approval unless you chose a looser mode.</p></div></div>
<div class="step" data-reveal><div><h3>Run it and ship it</h3><p>Switch to Code to edit files, run the project in the terminal and see your dev server in the preview. Commit and push from the header when you are happy.</p></div></div>
</div></div></section>
${cta('Ready to check your setup?', 'Kern needs a model to talk to and a desktop to run on.')}`,
})

// ---------- Requirements ----------
pages.push({
  file: 'requirements.html',
  title: 'Requirements | Kern',
  description: 'What you need on your computer to run Kern.',
  body: `${head('Requirements', 'What Kern needs.', '')}
<section><div class="wrap prose">
<p><strong>Kern is in private development and is not publicly distributed yet.</strong> There is no download. This page lists what it needs so you know what to expect.</p>
<h2>System</h2>
<ul><li>Windows 10 or 11, macOS, or Linux x64. Builds are unsigned.</li><li>A desktop screen. Kern is designed for a desktop window and has no mobile layout.</li></ul>
<h2>Something to connect</h2>
<p>Kern has no model of its own, so bring at least one:</p>
<ul><li>A local server: Ollama, LM Studio, vLLM or llama.cpp, or any OpenAI compatible server on this computer.</li><li>A key saved under Connections, for example Google Gemini, Mistral, Hugging Face or OpenRouter.</li><li>The Claude or Codex command line tools, if you already use them.</li></ul>
<h2>The engine</h2>
<p>Today Kern talks to models through the opencode command line engine, which you install once:</p>
<pre><code>npm i -g opencode-ai</code></pre>
<p>It needs Node 20 or newer. If it lives somewhere unusual, set <code>KERN_OPENCODE_BIN</code> to its path.</p>
<h2>Optional</h2>
<ul><li><code>git</code> on your PATH for the Git controls.</li></ul>
</div></section>`,
})

// ---------- FAQ ----------
pages.push({
  file: 'faq.html',
  title: 'FAQ | Kern',
  description: 'Answers about what Kern is, which models it works with and what it sends over the network.',
  body: `${head('FAQ', 'Questions.', '')}
<section><div class="wrap prose faq">
<details><summary>What is Kern?</summary><p>A desktop app that connects all your AI agents and models in one workspace. You work on separate projects at the same time, each in its own window, and choose a model per window.</p></details>
<details><summary>Is Kern an AI?</summary><p>No. It is not an agent or a model. It is the app you connect them to, with the controls around them: review, approvals, projects and keys.</p></details>
<details><summary>Which models can I connect?</summary><p>Claude, GPT, Gemini, Kimi, Grok, Llama, Mistral and models running on your own computer, depending on what you connect: a local server, a key (Gemini, Mistral, Hugging Face, OpenRouter, OpenCode Zen), or the Claude and Codex command line tools.</p></details>
<details><summary>Do I have to pick one?</summary><p>No. Each window has its own model, so you can use several at once, on the same project or different ones.</p></details>
<details><summary>Can several agents really work at the same time?</summary><p>Yes. Every conversation is its own window, and every window belongs to a project. Run as many side by side as your machine can handle.</p></details>
<details><summary>Can I download it?</summary><p>Not yet. Kern is in private development and is not publicly distributed. There is no price, waitlist or release date.</p></details>
<details><summary>Does my code leave my computer?</summary><p>Not through Kern. If a window uses a model on your computer, nothing leaves it. If it uses a hosted model, your prompts and the files the agent reads go to that provider, as they would anywhere. See <a href="privacy.html">Privacy</a>.</p></details>
<details><summary>Can an agent change my files without asking?</summary><p>Only if you let it. By default edits and shell commands ask first. Full access is a deliberate choice you make per agent.</p></details>
<details><summary>Do I need an account?</summary><p>No. There is no Kern account and no login.</p></details>
<details><summary>Why is there no mobile version?</summary><p>Kern is a desktop tool that needs your project folders and a terminal. It is not designed for small screens.</p></details>
</div></section>`,
})

// ---------- Security ----------
pages.push({
  file: 'security.html',
  title: 'Security | Kern',
  description: 'How Kern keeps your code, keys and conversations on your computer.',
  body: `${head('Security', 'Built to stay on your machine.', 'Each claim below is something the app enforces, not a promise.')}
<section><div class="wrap prose">
<table><tbody>
<tr><th scope="row">The interface cannot reach the network</th><td>All requests go through the app's main process, and the packaged interface ships with a content security policy of <code>connect-src 'self'</code>.</td></tr>
<tr><th scope="row">The interface cannot touch your system</th><td>Context isolation is on, Node integration is off, and the interface gets a small typed API.</td></tr>
<tr><th scope="row">Agents ask first</th><td>Edits, shell commands and access outside the project are set to ask by default. Looser modes are your choice, per agent.</td></tr>
<tr><th scope="row">Added endpoints stay local</th><td>Servers you add inside Kern must be on this computer (loopback addresses).</td></tr>
<tr><th scope="row">Keys are encrypted</th><td>Saved values use your operating system's secret storage and are only decrypted in the main process.</td></tr>
<tr><th scope="row">No sharing, no automatic updates</th><td>Sharing and automatic updates are turned off for the agents Kern runs.</td></tr>
<tr><th scope="row">No telemetry</th><td>No analytics, crash reporting or account. This website sets no cookies.</td></tr>
</tbody></table>
<h2>Limits, plainly</h2>
<ul><li>Builds are not signed yet, so Windows and macOS will warn on first launch.</li><li>A hosted model sees whatever the agent sends it. Kern cannot change that.</li><li>The Claude and Codex command line bridge receives every saved connection, regardless of per project settings.</li></ul>
</div></section>`,
})

// ---------- Privacy ----------
pages.push({
  file: 'privacy.html',
  title: 'Privacy | Kern',
  description: 'What Kern stores, what it sends and what it never collects.',
  body: `${head('Privacy', 'Local by design.', '')}
<section><div class="wrap prose">
<h2>What Kern collects</h2>
<p>Nothing. Kern has no analytics, no telemetry, no crash reporting and no account. This website sets no cookies and loads no third party scripts or fonts.</p>
<h2>What it stores, and where</h2>
<p>Settings, your project list and saved connection values are stored in Kern's profile folder on your computer. Nothing is synced.</p>
<h2>What it sends</h2>
<ul>
<li><strong>To models you run locally:</strong> your prompts, to loopback addresses on this computer.</li>
<li><strong>To hosted models you connect:</strong> your prompts and any files the agent reads, sent straight to that provider under its own terms.</li>
<li><strong>To a service you connect:</strong> a key you save under Connections is encrypted on this computer, used for a check against that service, and passed as an environment variable to the projects you allow. One exception: if you use the Claude or Codex command line tools as a model, their local bridge receives every saved connection.</li>
</ul>
</div></section>`,
})

// ---------- Changelog ----------
pages.push({
  file: 'changelog.html',
  title: 'Changelog | Kern',
  description: 'What is in the current Kern build, and what is not there yet.',
  body: `${head('Changelog', 'What is in this build.', '')}
<section><div class="wrap prose">
<h2>0.1.0, in development</h2>
<ul>
<li>One workspace for many agents: every conversation is its own window, each tied to a project.</li>
<li>Connect local models, hosted models with a key, and the Claude and Codex command line tools. Pick a model per window.</li>
<li>Diff review for every edit, separate approval for shell commands, and three approval modes.</li>
<li>Projects library with search, sort, list and grid, pins, watched folders and missing folder handling.</li>
<li>Code view with a file explorer, Monaco editor, terminal and live preview.</li>
<li>Git controls in the header: branch, changes, ahead and behind, commit and push.</li>
<li>Connections: ${providers.length} services, encrypted keys, live checks where a service supports them, and a per project access list.</li>
<li>Skills listed in the sidebar.</li>
</ul>
<h2>Not yet</h2>
<ul>
<li>Agents do not resume on their own after a model failure. A Continue button restarts the work.</li>
<li>Installers are unsigned, and there are no automatic updates.</li>
<li>No public download.</li>
</ul>
</div></section>`,
})

// ---------- About ----------
pages.push({
  file: 'about.html',
  title: 'About | Kern',
  description: 'Why Kern exists and what it is for.',
  body: `${head('About', 'One place for every agent.', 'There are many good AI coding agents and models, and each one wants its own window. Kern is for people who use more than one.')}
<section class="section"><div class="wrap"><h2 class="sr-only">Principles</h2><div class="grid grid--3">
${card('01', 'Neutral', 'Kern does not favour a model. It connects whatever you use and gets out of the way.')}
${card('02', 'Local', 'Your projects, keys and conversations stay on your computer. Nothing is sent anywhere you did not choose.')}
${card('03', 'Quiet', 'A calm, dark workspace that shows what every agent is doing without shouting about it.')}
</div></div></section>
<section class="section"><div class="wrap prose"><h2>Where it is</h2><p>Kern is in private development, built by Nick. It is not publicly distributed yet and has no release date, price or waitlist. When that changes, this site will say so.</p></div></section>
${cta('See what it does.', '', ['features.html', 'Features'], ['faq.html', 'FAQ'])}`,
})

// ---------- 404 ----------
pages.push({
  file: '404.html',
  title: 'Page not found | Kern',
  description: 'This page does not exist.',
  body: `<section class="hero"><canvas class="dots dots--hero" data-cell="17" aria-hidden="true"></canvas><div class="wrap"><p class="eyebrow">404</p><h1>Nothing here.</h1><p class="hero__lede">That page does not exist.</p><div class="hero__actions"><a class="btn btn--primary" href="index.html">Back to home ${ARROW}</a></div></div></section>`,
})

for (const p of pages) fs.writeFileSync(path.join(here, p.file), page(p))
console.log(`wrote ${pages.length} pages`)
