// Kern website behaviour: header, navigation, scroll animations, buttons and the app preview.
// Everything is progressive enhancement; the pages read fine without this file.
(() => {
  const root = document.documentElement
  root.classList.remove('no-js')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  // ----- header: hairline after scrolling, hides on the way down, returns on the way up, progress bar -----
  const header = document.querySelector('[data-site]')
  const nav = document.querySelector('#site-nav')
  const toggle = document.querySelector('[data-nav-toggle]')
  let lastY = window.scrollY
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (header) {
        header.classList.toggle('is-scrolled', y > 8)
        header.style.setProperty('--p', max > 0 ? String(Math.min(1, y / max)) : '0')
        const menuOpen = nav && nav.dataset.open === 'true'
        if (!reduced && !menuOpen && !document.querySelector('.nav__group.is-open')) {
          if (y > 260 && y - lastY > 6) header.classList.add('is-hidden')
          else if (lastY - y > 6 || y < 120) header.classList.remove('is-hidden')
        }
      }
      root.style.setProperty('--par', String(Math.round(y * 0.12)))
      lastY = y
      ticking = false
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // ----- navigation: dropdowns, sliding highlight, mobile sheet -----
  if (nav) {
    const ind = nav.querySelector('.nav__ind')
    const links = [...nav.querySelectorAll('.nav__link')]
    const groups = [...nav.querySelectorAll('.nav__group')]
    links.forEach((el, i) => el.style.setProperty('--k', String(i)))
    nav.querySelectorAll('.menu a').forEach((el, i) => el.style.setProperty('--k', String(i + links.length)))

    const currentLink = () => links.find((l) => l.getAttribute('aria-current') === 'page') || (nav.querySelector('.nav__group.is-current > .nav__link'))
    const moveTo = (el) => {
      if (!ind || !el || window.innerWidth <= 860) return
      const a = nav.getBoundingClientRect(), b = el.getBoundingClientRect()
      ind.style.width = `${b.width}px`
      ind.style.transform = `translateX(${b.left - a.left}px)`
      ind.style.opacity = '1'
    }
    const rest = () => { const c = currentLink(); if (c) moveTo(c); else if (ind) ind.style.opacity = '0' }
    links.forEach((el) => { el.addEventListener('pointerenter', () => finePointer && moveTo(el)); el.addEventListener('focus', () => moveTo(el)) })
    nav.addEventListener('pointerleave', rest)
    nav.addEventListener('focusout', (event) => { if (!nav.contains(event.relatedTarget)) rest() })
    rest()
    window.addEventListener('resize', rest)

    let closeTimer = 0
    const setOpen = (group, open) => {
      group.classList.toggle('is-open', open)
      group.querySelector('.nav__link').setAttribute('aria-expanded', String(open))
    }
    const closeAll = (except) => groups.forEach((g) => { if (g !== except) setOpen(g, false) })
    groups.forEach((group) => {
      const button = group.querySelector('.nav__link')
      group.addEventListener('pointerenter', () => { if (!finePointer) return; clearTimeout(closeTimer); closeAll(group); setOpen(group, true) })
      group.addEventListener('pointerleave', () => { if (!finePointer) return; closeTimer = window.setTimeout(() => setOpen(group, false), 140) })
      button.addEventListener('click', () => { const open = !group.classList.contains('is-open'); closeAll(group); setOpen(group, open) })
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(group, true); group.querySelector('.menu a').focus() }
      })
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { setOpen(group, false); button.focus() }
        const items = [...group.querySelectorAll('.menu a')]
        const at = items.indexOf(document.activeElement)
        if (at >= 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus()
        }
      })
      group.addEventListener('focusout', (event) => { if (!group.contains(event.relatedTarget)) setOpen(group, false) })
    })
    document.addEventListener('pointerdown', (event) => { if (!nav.contains(event.target)) closeAll() })

    if (toggle) {
      const setSheet = (open) => {
        nav.dataset.open = String(open)
        toggle.setAttribute('aria-expanded', String(open))
        document.body.style.overflow = open ? 'hidden' : ''
        if (open) header && header.classList.remove('is-hidden')
      }
      toggle.addEventListener('click', () => setSheet(nav.dataset.open !== 'true'))
      nav.addEventListener('click', (event) => { if (event.target.closest('a')) setSheet(false) })
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && nav.dataset.open === 'true') { setSheet(false); toggle.focus() } })
      window.addEventListener('resize', () => { if (window.innerWidth > 860 && nav.dataset.open === 'true') setSheet(false) })
    }
  }

  // ----- scroll reveal: fades in on the way down, and again whenever it comes back into view -----
  const items = [...document.querySelectorAll('[data-reveal]')]
  if ('IntersectionObserver' in window && items.length) {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-in', entry.isIntersecting)
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.08 })
    items.forEach((el) => {
      const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal')) : []
      el.style.setProperty('--i', String(Math.max(0, siblings.indexOf(el))))
      seen.observe(el)
    })
  } else items.forEach((el) => el.classList.add('is-in'))

  // ----- steps: the one nearest the middle of the screen is lit -----
  const steps = [...document.querySelectorAll('.step')]
  if ('IntersectionObserver' in window && steps.length) {
    const lit = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-active', entry.isIntersecting)
    }, { rootMargin: '-40% 0px -40% 0px' })
    steps.forEach((el) => lit.observe(el))
  } else steps.forEach((el) => el.classList.add('is-active'))

  // ----- pointer effects: one spotlight follows the cursor across a whole card grid, buttons lean toward it -----
  if (finePointer && !reduced) {
    document.addEventListener('pointermove', (event) => {
      const grid = event.target.closest && event.target.closest('.grid')
      if (grid) { const r = grid.getBoundingClientRect(); grid.style.setProperty('--mx', `${event.clientX - r.left}px`); grid.style.setProperty('--my', `${event.clientY - r.top}px`) }
      const btn = event.target.closest && event.target.closest('.btn')
      if (btn) {
        const r = btn.getBoundingClientRect()
        const dx = (event.clientX - (r.left + r.width / 2)) / r.width, dy = (event.clientY - (r.top + r.height / 2)) / r.height
        btn.style.setProperty('--tx', `${(dx * 8).toFixed(2)}px`)
        btn.style.setProperty('--ty', `${(dy * 6).toFixed(2)}px`)
      }
    }, { passive: true })
    document.addEventListener('pointerout', (event) => {
      const btn = event.target.closest && event.target.closest('.btn')
      if (btn && !btn.contains(event.relatedTarget)) { btn.style.setProperty('--tx', '0px'); btn.style.setProperty('--ty', '0px') }
    })
  }

  // ----- logo strip: the glow follows whichever logo is under the pointer, even while the strip scrolls -----
  const strip = document.querySelector('.marquee')
  if (strip && finePointer) {
    let px = -1, py = -1, raf = 0, hot = null
    const tick = () => {
      const el = document.elementFromPoint(px, py)
      const item = el && el.closest ? el.closest('.marquee__item') : null
      if (item !== hot) { if (hot) hot.classList.remove('is-hot'); if (item) item.classList.add('is-hot'); hot = item }
      raf = requestAnimationFrame(tick)
    }
    strip.addEventListener('pointerenter', (event) => { px = event.clientX; py = event.clientY; if (!raf) raf = requestAnimationFrame(tick) })
    strip.addEventListener('pointermove', (event) => { px = event.clientX; py = event.clientY })
    strip.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = 0; if (hot) { hot.classList.remove('is-hot'); hot = null } })
  }

  // ----- app preview on the home page: sidebar sections -----
  const tabs = [...document.querySelectorAll('[data-tab]')]
  const panes = [...document.querySelectorAll('[data-pane]')]
  const select = (name, focus) => {
    for (const tab of tabs) {
      const on = tab.dataset.tab === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      if (on && focus) tab.focus()
    }
    for (const pane of panes) pane.classList.toggle('is-on', pane.dataset.pane === name)
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.tab, false))
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (!step) return
      event.preventDefault()
      select(tabs[(index + step + tabs.length) % tabs.length].dataset.tab, true)
    })
  })
})()
