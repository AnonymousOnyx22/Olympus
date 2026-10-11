// Interactive demos on the website: model picker, diff review, approval modes, projects library.
// Sample data only. Nothing here talks to a network.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms))

  // ---------- model picker: one window, any model ----------
  const mpRoot = document.querySelector('[data-modelpicker]')
  if (mpRoot) {
    const GROUPS = [
      ['On this computer', [['Llama', 'Ollama'], ['Qwen Coder', 'LM Studio']]],
      ['Command-line tools you already use', [['Claude', 'Claude CLI'], ['GPT', 'Codex CLI']]],
      ['Through a key', [['Gemini', 'API key'], ['Mistral', 'API key'], ['Kimi', 'via OpenRouter'], ['Grok', 'via OpenRouter'], ['Llama (Meta)', 'via OpenRouter']]],
    ]
    const flat = GROUPS.flatMap(([, list]) => list)
    let current = 'Claude'
    mpRoot.innerHTML = `<div class="win" aria-label="A Kern agent window with a model picker">
<div class="win__head"><span class="dot dot--live"></span>Home page copy<small>studio</small></div>
<div class="win__body"><p class="you">Make the home page headline clearer.</p><p class="reply" data-reply><b>Claude</b> is on this window. I will tighten the headline and keep the supporting copy.</p></div>
<div class="composer"><div class="composer__text">Give the agent a task…</div><div class="composer__bar">
<div class="mp"><button type="button" class="mp__btn" aria-haspopup="listbox" aria-expanded="false"><span class="mp__name" data-name>Claude</span><svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m1 1 4 4 4-4"/></svg></button>
<div class="mp__pop" role="dialog" aria-label="Choose a model"><input class="mp__search" type="search" placeholder="Search models…" aria-label="Search models" autocomplete="off"><div class="mp__list" role="listbox" aria-label="Models"></div></div></div>
<span class="send" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></span></div></div></div>`
    const btn = mpRoot.querySelector('.mp__btn'), pop = mpRoot.querySelector('.mp__pop')
    const search = mpRoot.querySelector('.mp__search'), list = mpRoot.querySelector('.mp__list')
    const nameEl = mpRoot.querySelector('[data-name]'), reply = mpRoot.querySelector('[data-reply]')
    const options = () => [...list.querySelectorAll('.mp__opt')]
    const draw = () => {
      const q = search.value.trim().toLowerCase()
      const out = GROUPS.map(([g, items]) => {
        const shown = items.filter(([n, how]) => !q || `${n} ${how}`.toLowerCase().includes(q))
        return shown.length ? `<div class="mp__group">${esc(g)}</div>${shown.map(([n, how]) => `<button type="button" class="mp__opt" role="option" aria-selected="${n === current}" data-model="${esc(n)}">${esc(n)}<small>${esc(how)}</small></button>`).join('')}` : ''
      }).join('')
      list.innerHTML = out || '<p class="mp__empty">No models match.</p>'
    }
    const open = (state) => {
      pop.classList.toggle('is-open', state)
      btn.setAttribute('aria-expanded', String(state))
      if (state) { search.value = ''; draw(); setTimeout(() => search.focus({ preventScroll: true }), 30) }
    }
    const choose = (name) => {
      const how = (flat.find(([n]) => n === name) || [])[1] || ''
      current = name
      nameEl.textContent = name
      nameEl.classList.remove('is-swap'); void nameEl.offsetWidth; nameEl.classList.add('is-swap')
      reply.innerHTML = `<b>${esc(name)}</b> is on this window now (${esc(how.toLowerCase())}). Same project, same conversation. Other windows keep their own models.`
      reply.classList.remove('reply'); void reply.offsetWidth; reply.classList.add('reply')
      open(false)
      btn.focus()
    }
    btn.addEventListener('click', () => open(!pop.classList.contains('is-open')))
    search.addEventListener('input', draw)
    list.addEventListener('click', (e) => { const o = e.target.closest('.mp__opt'); if (o) choose(o.dataset.model) })
    mpRoot.addEventListener('keydown', (e) => {
      if (!pop.classList.contains('is-open')) return
      if (e.key === 'Escape') { open(false); btn.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const opts = options(); if (!opts.length) return
        const at = opts.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? (at + 1) % opts.length : (at <= 0 ? opts.length - 1 : at - 1)
        opts[next].focus()
      }
    })
    document.addEventListener('pointerdown', (e) => { if (!mpRoot.contains(e.target)) open(false) })
  }

  // ---------- diff review ----------
  const dv = document.querySelector('[data-diff]')
  if (dv) {
    const status = dv.querySelector('[data-status]'), reason = dv.querySelector('[data-reason]')
    const accept = dv.querySelector('[data-accept]'), reject = dv.querySelector('[data-reject]'), reset = dv.querySelector('[data-reset]')
    const show = (done) => { accept.hidden = done; reject.hidden = done; reset.hidden = !done }
    accept.addEventListener('click', () => { dv.classList.remove('is-asking'); dv.classList.add('is-accepted'); status.textContent = 'Accepted. Written to src/Hero.tsx.'; show(true) })
    reject.addEventListener('click', () => {
      if (!dv.classList.contains('is-asking')) { dv.classList.add('is-asking'); reject.textContent = 'Send back'; reason.focus(); return }
      dv.classList.remove('is-asking'); dv.classList.add('is-rejected')
      const why = reason.value.trim()
      status.textContent = why ? `Rejected. The agent was told: "${why}"` : 'Rejected. Nothing was written.'
      reject.textContent = 'Reject'; show(true)
    })
    reset.addEventListener('click', () => { dv.classList.remove('is-accepted', 'is-rejected', 'is-asking'); reason.value = ''; status.textContent = '1 edit waiting for review'; show(false) })
  }

  // ---------- approval modes ----------
  const modes = document.querySelector('[data-modes]')
  if (modes) {
    const INFO = {
      ask: 'Always ask before edits or commands. Nothing happens until you say so.',
      edit: 'Only asks about actions that look unsafe. Routine edits and test runs go through.',
      bypass: 'Unrestricted access to files and commands. Choose it deliberately.',
    }
    const ACTIONS = [['Edit src/Hero.tsx', false], ['Run npm test', false], ['Run rm -rf dist', true]]
    const buttons = [...modes.querySelectorAll('[data-mode]')], info = modes.querySelector('[data-info]'), tl = modes.querySelector('[data-tl]')
    let mode = 'ask', token = 0
    const set = (m) => { mode = m; buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); info.textContent = INFO[m]; tl.innerHTML = ''; token++ }
    const statusFor = (danger) => {
      if (mode === 'bypass') return '<span class="st full">Ran without asking</span>'
      if (mode === 'edit' && !danger) return '<span class="st ok">Approved automatically</span>'
      return '<span class="st wait">Waiting for you <button type="button" data-allow>Allow</button></span>'
    }
    buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.mode)))
    modes.querySelector('[data-run]').addEventListener('click', async () => {
      const mine = ++token
      tl.innerHTML = ''
      for (const [label, danger] of ACTIONS) {
        if (mine !== token) return
        const li = document.createElement('li')
        if (danger) li.classList.add('is-danger')
        li.innerHTML = `<span>${esc(label)}</span>${statusFor(danger)}`
        tl.appendChild(li)
        await sleep(520)
      }
    })
    tl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-allow]'); if (!b) return
      b.closest('.st').outerHTML = '<span class="st ok">Approved by you</span>'
    })
    set('ask')
  }

  // ---------- projects library ----------
  const lib = document.querySelector('[data-library]')
  if (lib) {
    const ALL = [
      { id: 'studio', path: '~/work/studio', tag: 'Vite · React', opened: 6, pinned: true, status: 'working' },
      { id: 'notes', path: '~/work/notes', tag: 'Next.js', opened: 5, pinned: false, status: 'idle' },
      { id: 'api', path: '~/work/api', tag: 'Node · Express', opened: 4, pinned: false, status: 'attention' },
      { id: 'mobile', path: '~/work/mobile', tag: 'Expo', opened: 3, pinned: false, status: 'idle' },
      { id: 'pipeline', path: '~/work/pipeline', tag: 'Python', opened: 2, pinned: false, status: 'idle' },
      { id: 'dotfiles', path: '~/dotfiles', tag: 'Shell', opened: 1, pinned: false, status: 'idle' },
    ]
    const state = { q: '', sort: 'recent', layout: 'list', missing: false, flash: null, anim: true }
    const STATUS = { working: ['dot dot--live', 'Agent working'], attention: ['dot dot--warn', 'Needs approval'], idle: ['dot dot--idle', 'Idle'] }
    const pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6Z"/></svg>'
    const render = () => {
      const q = state.q.trim().toLowerCase()
      let rows = ALL.filter((p) => !(state.missing && p.id === 'dotfiles') && (!q || `${p.id} ${p.path} ${p.tag}`.toLowerCase().includes(q)))
      rows.sort((a, b) => (b.pinned - a.pinned) || (state.sort === 'name' ? a.id.localeCompare(b.id) : b.opened - a.opened))
      const list = lib.querySelector('[data-list]')
      list.className = `lib__list${state.layout === 'grid' ? ' is-grid' : ''}`
      list.innerHTML = (rows.length ? rows.map((p, n) => `<article class="pj${state.flash === p.id ? ' is-flash' : ''}" style="--n:${state.anim ? n : 0};${state.anim ? '' : 'animation:none'}"><h3>${esc(p.id)}<span class="pj__tag">${esc(p.tag)}</span></h3><button type="button" class="pj__pin" data-pin="${p.id}" aria-pressed="${p.pinned}" aria-label="${p.pinned ? 'Unpin' : 'Pin'} ${esc(p.id)}">${pin}</button><small>${esc(p.path)}</small>${state.layout === 'grid' ? '' : ''}<span class="pj__status"><span class="${STATUS[p.status][0]}"></span>${STATUS[p.status][1]}</span></article>`).join('') : '<p class="lib__empty">No matching projects.</p>') +
        (state.missing ? '<p class="lib__missing">dotfiles is hidden because its folder is missing. It comes back on its own when the folder does.</p>' : '')
      state.anim = false; state.flash = null
    }
    lib.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { state.q = e.target.value; render() } })
    lib.addEventListener('change', (e) => { if (e.target.matches('[data-sort]')) { state.sort = e.target.value; state.anim = true; render() } })
    lib.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return
      if (t.dataset.layout) { state.layout = t.dataset.layout; lib.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); state.anim = true; render() }
      else if (t.dataset.pin) { const p = ALL.find((x) => x.id === t.dataset.pin); p.pinned = !p.pinned; state.flash = p.id; render() }
      else if (t.dataset.missing !== undefined) { state.missing = !state.missing; t.setAttribute('aria-pressed', String(state.missing)); render() }
    })
    render()
  }
})()
