// Interactive replica of Kern's Connections page (app/src/components/ConnectionsSettings.tsx).
// Same providers, same layout, same states: not connected, checking, verified, failed, incomplete and
// saved without a test. Nothing here talks to a network; the "check" is a short simulated delay.
(() => {
  const DATA = window.KERN_CONNECTIONS || []
  const roots = document.querySelectorAll('[data-connections]')
  if (!DATA.length || !roots.length) return

  const PROJECTS = [
    { id: 'studio', name: 'studio', path: '~/work/studio' },
    { id: 'notes', name: 'notes', path: '~/work/notes' },
    { id: 'api', name: 'api', path: '~/work/api' },
  ]
  const LOOK = {
    verified: { label: 'Verified', badge: 'cx-b-ok', text: 'cx-t-ok' },
    failed: { label: 'Failed', badge: 'cx-b-bad', text: 'cx-t-bad' },
    incomplete: { label: 'Incomplete', badge: 'cx-b-warn', text: 'cx-t-warn' },
    unchecked: { label: 'Saved, no test', badge: 'cx-b-idle', text: 'cx-t-idle' },
  }
  const NOT_CHECKED = { label: 'Not checked yet', badge: 'cx-b-warn' }
  const NO_TEST = 'There is no automatic test for this service yet. The values are saved and encrypted, but not tested.'
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const byId = (id) => DATA.find((p) => p.id === id)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, reduced ? Math.min(ms, 200) : ms))

  const logo = (p, cls) => {
    const i = p.icon
    if (i && i.fill) return `<svg viewBox="0 0 24 24" class="${cls}" fill="currentColor" aria-hidden="true"><path d="${i.fill}"/></svg>`
    if (i && i.stroke) return `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${i.stroke}"/></svg>`
    return `<span class="${cls}" aria-hidden="true">${esc(p.name.slice(0, 2).toUpperCase())}</span>`
  }
  const isOptional = (field) => /optional/i.test(field.label)

  // What the app's own check would say, given what was typed. Mirrors connectionChecks.ts wording.
  function runCheck(provider, values) {
    if (!provider.check) return { status: 'unchecked', detail: NO_TEST }
    const missing = provider.fields.filter((f) => !isOptional(f) && !values[f.key]).map((f) => f.label)
    if (missing.length) return { status: 'incomplete', detail: `Not complete yet: ${missing.join(', ')} still needs a value.` }
    const secret = provider.fields.find((f) => f.secret)
    const typed = secret ? values[secret.key] : ''
    if (secret && (typed.length < 8 || /bad|wrong|fake/i.test(typed))) {
      return { status: 'failed', detail: `${provider.name} rejected this key (401). Check it was copied in full and has the right permissions.` }
    }
    if (provider.id === 'stripe') {
      return { status: 'verified', detail: /^sk_live/.test(typed) ? 'Verified, LIVE mode. Checkouts will take real money.' : 'Verified, test mode. No real money moves.' }
    }
    return { status: 'verified', detail: 'Verified.' }
  }

  function mount(root) {
    const state = {
      view: 'list', selected: null, search: '', savedOnly: false, busy: null,
      drafts: {}, values: {}, animate: true, flash: false,
      saved: {}, optOut: {},
    }
    const seed = (id, fields, check) => {
      const provider = byId(id)
      if (!provider) return
      state.saved[id] = { fields: [...fields], check }
      state.values[id] = Object.fromEntries(fields.map((k) => [k, 'sk_test_demo_value']))
    }
    seed('stripe', ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'], { status: 'verified', detail: 'Verified, test mode. No real money moves.' })
    seed('openrouter', ['OPENROUTER_API_KEY'], { status: 'verified', detail: 'Verified.' })
    seed('figma', ['FIGMA_ACCESS_TOKEN'], { status: 'unchecked', detail: NO_TEST })

    const envHost = document.querySelector(root.dataset.env ? root.dataset.env : '[data-connections-env]')
    const connected = (id) => !!state.saved[id] && state.saved[id].fields.length > 0
    const allowed = (projectId, id) => !(state.optOut[projectId] || []).includes(id)
    const hasDraft = (id) => Object.values(state.drafts[id] || {}).some((v) => v.trim())

    // ----- views -----
    const listView = () => {
      const q = state.search.trim().toLowerCase()
      const shown = DATA.filter((p) => (!state.savedOnly || connected(p.id)) && (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)))
      const groups = new Map()
      for (const p of shown) { if (!groups.has(p.category)) groups.set(p.category, []); groups.get(p.category).push(p) }
      let n = 0
      const body = groups.size === 0
        ? `<div class="cx-state"><p class="cx-state-title">No matching connections</p><p class="cx-state-desc">Try another name or show all providers.</p><button type="button" class="cx-ghost" data-act="clear">Clear filters</button></div>`
        : `<div class="cx-groups">${[...groups].map(([category, list]) => `<div><h2 class="cx-cat">${esc(category)}</h2><div class="cx-list">${list.map((p) => {
          const s = state.saved[p.id]
          const label = !connected(p.id) ? 'Not connected' : s.check ? LOOK[s.check.status].label : 'Saved, untested'
          return `<button type="button" class="cx-row" data-act="open" data-id="${p.id}" style="--n:${n++}"><span class="cx-row-top">${logo(p, 'cx-logo')}<span class="cx-row-name">${esc(p.name)}</span><span class="cx-row-status${connected(p.id) ? ' is-on' : ''}">${label}</span></span><span class="cx-row-desc">${esc(p.description)}</span></button>`
        }).join('')}</div></div>`).join('')}</div>`
      return `<div class="cx-view${state.animate ? ' cx-enter' : ''}">
<div class="cx-filters" aria-label="Connection filters"><button type="button" data-act="all" aria-pressed="${!state.savedOnly}">All providers</button><button type="button" data-act="savedonly" aria-pressed="${state.savedOnly}">Saved connections</button></div>
<div class="cx-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input type="search" id="cx-search" value="${esc(state.search)}" placeholder="Search the library…" aria-label="Search connection providers" autocomplete="off"></div>
${body}</div>`
    }

    const detailView = () => {
      const p = byId(state.selected)
      const s = state.saved[p.id]
      const busy = state.busy === p.id
      const isConnected = connected(p.id)
      const look = s && s.check ? LOOK[s.check.status] : NOT_CHECKED
      const draft = state.drafts[p.id] || {}
      const flash = state.flash ? ' cx-pop' : ''
      const check = s && s.check && s.check.status === 'verified' && !busy
        ? `<svg class="cx-tick${state.flash ? ' is-draw' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>` : ''
      const spinner = busy ? '<span class="cx-spin" aria-hidden="true"></span>' : ''
      return `<div class="cx-view${state.animate ? ' cx-enter' : ''}">
<button type="button" class="cx-back" data-act="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>All connections</button>
<section class="cx-card">
<div class="cx-card-head"><div class="cx-id"><span class="cx-tile">${logo(p, 'cx-logo cx-logo--lg')}</span><div><p class="cx-card-cat">${esc(p.category)}</p><h2 class="cx-card-name" tabindex="-1" id="cx-name">${esc(p.name)}</h2><p class="cx-card-desc">${esc(p.description)}</p></div></div>
${isConnected ? `<span class="cx-badge ${look.badge}${flash}" role="status">${spinner}${check}<span>${busy ? 'Checking…' : look.label}</span></span>` : ''}</div>
${isConnected && s.check ? `<div class="cx-verify${flash}"><p class="${LOOK[s.check.status].text}">${esc(s.check.detail)}</p><button type="button" class="cx-link" data-act="verify" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : 'Check again'}</button></div>` : ''}
<fieldset class="cx-access"><legend>Available to projects</legend><ul>${PROJECTS.map((pr) => `<li><label><input type="checkbox" data-act="access" data-project="${pr.id}" ${allowed(pr.id, p.id) ? 'checked' : ''}><span title="${esc(pr.path)}">${esc(pr.name)}</span></label></li>`).join('')}</ul><p>Unchecked projects do not receive this connection. A project's agent picks up the change the next time it starts.</p></fieldset>
<div class="cx-fields">${p.fields.map((f) => {
        const saved = !!s && s.fields.includes(f.key)
        return `<div><label for="cx-f-${f.key}">${esc(f.label)}${saved ? '<span class="cx-saved">saved</span>' : ''}</label><input id="cx-f-${f.key}" data-field="${f.key}" type="${f.secret ? 'password' : 'text'}" value="${esc(draft[f.key] || '')}" placeholder="${esc(saved ? 'Saved - type a new value to replace it' : f.placeholder || '')}" autocomplete="off" spellcheck="false"></div>`
      }).join('')}</div>
<div class="cx-actions">${isConnected ? `<button type="button" class="cx-remove" data-act="remove" ${busy ? 'disabled' : ''}>Remove</button>` : ''}<button type="button" class="cx-save" data-act="save" ${!hasDraft(p.id) || busy ? 'disabled' : ''}>${busy ? 'Saving and checking…' : 'Save'}</button></div>
</section></div>`
    }

    // ----- render, keeping focus and caret through a re-render -----
    function render(focusAfter) {
      const active = document.activeElement
      const keep = root.contains(active) && active.id ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null
      root.innerHTML = `<div class="cx-page"><h1>Connections</h1><p class="cx-lede">Saved API keys are encrypted by this computer. Every project's agent gets each saved connection unless you uncheck that project on the connection's page. Saving tests the key where the service has a test. A running agent picks up changes the next time it starts.</p>${state.view === 'detail' ? detailView() : listView()}</div>`
      state.animate = false
      state.flash = false
      const target = focusAfter ? root.querySelector(focusAfter) : keep ? root.querySelector('#' + CSS.escape(keep.id)) : null
      if (target) {
        target.focus({ preventScroll: true })
        if (keep && keep.s != null) { try { target.setSelectionRange(keep.s, keep.e) } catch (error) { /* not a text field */ } }
      }
      updateEnv()
    }

    // ----- the live "what each agent receives" panel (outside the replica, optional) -----
    const prevEnv = {}
    function updateEnv() {
      if (!envHost) return
      envHost.innerHTML = PROJECTS.map((pr) => {
        const names = []
        for (const p of DATA) if (connected(p.id) && allowed(pr.id, p.id)) for (const k of state.saved[p.id].fields) names.push(k)
        const before = prevEnv[pr.id] || []
        prevEnv[pr.id] = names
        const chips = names.length ? names.map((k) => `<li class="${before.includes(k) ? '' : 'is-new'}"><code>${esc(k)}</code></li>`).join('') : '<li class="cx-none">Nothing. No connection reaches this agent.</li>'
        return `<div class="cx-env"><h3>${esc(pr.name)}</h3><p>Agent starts with ${names.length} variable${names.length === 1 ? '' : 's'}</p><ul>${chips}</ul></div>`
      }).join('')
    }

    // ----- actions -----
    async function runBusy(id, work) {
      state.busy = id
      render()
      await sleep(950)
      work()
      state.busy = null
      state.flash = true
      render()
    }
    root.addEventListener('click', (event) => {
      const el = event.target.closest('[data-act]')
      if (!el || !root.contains(el)) return
      const act = el.dataset.act
      if (act === 'open') { state.selected = el.dataset.id; state.view = 'detail'; state.animate = true; render('#cx-name') }
      else if (act === 'back') { const id = state.selected; state.view = 'list'; state.selected = null; state.animate = true; render(`[data-id="${id}"]`) }
      else if (act === 'all' || act === 'savedonly') { state.savedOnly = act === 'savedonly'; render() }
      else if (act === 'clear') { state.search = ''; state.savedOnly = false; render() }
      else if (act === 'save') {
        const id = state.selected
        const p = byId(id)
        if (!hasDraft(id) || state.busy) return
        const draft = state.drafts[id]
        const entry = state.saved[id] || (state.saved[id] = { fields: [], check: null })
        state.values[id] = state.values[id] || {}
        for (const f of p.fields) if ((draft[f.key] || '').trim()) { state.values[id][f.key] = draft[f.key].trim(); if (!entry.fields.includes(f.key)) entry.fields.push(f.key) }
        state.drafts[id] = {}
        runBusy(id, () => { entry.check = runCheck(p, state.values[id]) })
      } else if (act === 'verify') {
        const id = state.selected
        if (state.busy) return
        runBusy(id, () => { state.saved[id].check = runCheck(byId(id), state.values[id] || {}) })
      } else if (act === 'remove') {
        const id = state.selected
        if (state.busy) return
        delete state.saved[id]; delete state.values[id]; state.drafts[id] = {}
        state.view = 'list'; state.selected = null; state.animate = true
        render()
      }
    })
    root.addEventListener('input', (event) => {
      const el = event.target
      if (el.id === 'cx-search') { state.search = el.value; render() }
      else if (el.dataset.field) {
        const id = state.selected
        state.drafts[id] = state.drafts[id] || {}
        state.drafts[id][el.dataset.field] = el.value
        const save = root.querySelector('[data-act="save"]')
        if (save) save.disabled = !hasDraft(id) || !!state.busy
      }
    })
    root.addEventListener('change', (event) => {
      const el = event.target
      if (el.dataset.act !== 'access') return
      const list = new Set(state.optOut[el.dataset.project] || [])
      if (el.checked) list.delete(state.selected); else list.add(state.selected)
      state.optOut[el.dataset.project] = [...list]
      updateEnv()
    })
    render()
  }
  roots.forEach(mount)
})()
