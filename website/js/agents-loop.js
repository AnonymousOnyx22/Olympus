// The four agent windows in the home page preview are always at work: each one plays a short task
// (think, read, reply, edit, wait for approval, run tests) and then starts the next, forever. The
// "thinking" mark in each header is three glowing dots. Sample scripts only, no network.
// Reduced motion leaves the static first state in place.
(() => {
  const wins = [...document.querySelectorAll('[data-agent]')]
  if (!wins.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

  // One "thinking" indicator for every window: three glowing dots that pulse in turn.
  const DOTS = '<span class="think-dots" aria-hidden="true"><i></i><i></i><i></i></span>'

  const SCRIPTS = {
    claude: [
      { title: 'Homepage headline', you: 'Give the home page a clear, welcoming headline.', steps: [
        ['think', 1700], ['tool', 'Read src/Hero.tsx', 900], ['say', "I'll update the heading and the supporting copy. You can review the change before it is applied."],
        ['tool', 'Edit src/Hero.tsx', 700], ['review', '1 edit waiting for review', 'Accept', 'Written to src/Hero.tsx', 2300], ['say', 'Done. The headline now leads with what the studio does.'], ['pause', 1900]] },
      { title: 'Footer links', you: 'Add social links to the footer.', steps: [
        ['think', 1500], ['tool', 'Read src/Footer.tsx', 800], ['say', 'Adding three links with clear labels that open in a new tab.'],
        ['tool', 'Edit src/Footer.tsx', 700], ['review', '1 edit waiting for review', 'Accept', 'Written to src/Footer.tsx', 2100], ['say', 'Done. Each link has rel="noopener".'], ['pause', 1900]] },
    ],
    gpt: [
      { title: 'Note search', you: 'Add search to the notes list.', steps: [
        ['think', 1500], ['tool', 'Edit src/NotesList.tsx', 1000], ['tool', 'npm test', 2000],
        ['say', 'All 14 tests pass. Search filters by title and body, ignoring case.'], ['pause', 2200]] },
      { title: 'Dark mode', you: 'Add a dark mode toggle.', steps: [
        ['think', 1700], ['tool', 'Edit src/theme.ts', 900], ['tool', 'Edit src/App.tsx', 800], ['tool', 'npm test', 1700],
        ['say', 'Toggle added. The choice is remembered between visits.'], ['pause', 2200]] },
    ],
    grok: [
      { title: 'Request logging', you: 'Log every request to the server.', steps: [
        ['think', 1600], ['say', 'I want to run a shell command to install a package.'],
        ['review', 'Waiting for your approval', 'Allow', 'Approved', 2400], ['tool', 'npm install morgan', 1500], ['tool', 'Edit src/server.ts', 800],
        ['say', 'Every request now logs its method, path and timing.'], ['pause', 1900]] },
      { title: 'Health check', you: 'Add a /health endpoint.', steps: [
        ['think', 1500], ['tool', 'Edit src/server.ts', 900], ['tool', 'curl localhost:3000/health', 1200],
        ['say', 'Returns 200 with the uptime in seconds.'], ['pause', 2200]] },
    ],
    kimi: [
      { title: 'README pass', you: 'Tidy the README.', steps: [
        ['think', 1600], ['tool', 'Read README.md', 800], ['say', 'Shortening the intro and fixing the setup steps.'],
        ['tool', 'Edit README.md', 900], ['say', 'Done. I added a section on running the tests.'], ['pause', 2200]] },
      { title: 'Changelog', you: 'Summarise this week into the changelog.', steps: [
        ['think', 1500], ['tool', 'git log', 1000], ['say', 'Seven changes, grouped by area.'],
        ['tool', 'Edit CHANGELOG.md', 900], ['say', 'Done. Fixes first, then features.'], ['pause', 2200]] },
    ],
  }

  const watch = (win) => {
    const state = { visible: true, waiters: [] }
    new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; if (state.visible) state.waiters.splice(0).forEach((r) => r()) }).observe(win)
    return () => (state.visible && !document.hidden ? Promise.resolve() : new Promise((r) => { state.waiters.push(r); document.addEventListener('visibilitychange', () => !document.hidden && r(), { once: true }) }))
  }

  async function play(win, index) {
    const key = win.dataset.agent
    const runs = SCRIPTS[key]
    const body = win.querySelector('[data-body]'), markEl = win.querySelector('[data-mark]'), titleEl = win.querySelector('[data-title]')
    const visible = watch(win)
    markEl.innerHTML = DOTS // the agents never stop working, so the dots never go away
    const add = (html, cls = '') => {
      const el = document.createElement('div')
      el.className = `loop-in ${cls}`.trim()
      el.innerHTML = html
      body.appendChild(el)
      while (body.scrollHeight > body.clientHeight + 2 && body.children.length > 2) body.children[1].remove()
      return el
    }
    await sleep(index * 650)
    for (let n = 0; ; n = (n + 1) % runs.length) {
      const run = runs[n]
      body.style.opacity = '0'; await sleep(220); body.innerHTML = ''; titleEl.textContent = run.title; body.style.opacity = '1'
      add(`<p class="you">${esc(run.you)}</p>`)
      for (const [kind, a, b, c, d] of run.steps) {
        await visible()
        if (kind === 'think' || kind === 'pause') await sleep(a)
        else if (kind === 'say') {
          const p = add('<p class="caret"></p>').firstChild
          for (let i = 1; i <= a.length; i++) { p.textContent = a.slice(0, i); await sleep(14) }
          p.classList.remove('caret')
        } else if (kind === 'tool') {
          const t = add(`<div class="tool"><span class="tool__ic is-run"></span><span>${esc(a)}</span></div>`)
          await sleep(b)
          t.querySelector('.tool__ic').className = 'tool__ic is-ok'
        } else if (kind === 'review') {
          const r = add(`<div class="review"><span>${esc(a)}</span><button type="button">${esc(b)}</button></div>`)
          const button = r.querySelector('button'), label = r.querySelector('span')
          const approve = () => { if (button.disabled) return; button.disabled = true; button.textContent = `${b === 'Allow' ? 'Allowed' : 'Accepted'}`; label.textContent = c }
          button.addEventListener('click', approve)
          const until = Date.now() + d
          while (!button.disabled && Date.now() < until) await sleep(80)
          approve()
          await sleep(500)
        }
      }
    }
  }
  wins.forEach((win, i) => play(win, i))
})()
