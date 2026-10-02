/* Progressive enhancement. No network requests, storage or analytics. */
(() => {
  'use strict';
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.getElementById('mobile-nav');
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.dataset.open = String(open);
  }
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu?.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', event => {
    if (menu && toggle && !menu.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

  // The three views share the same explicitly labelled sample session.
  const tabs = [...document.querySelectorAll('[data-demo-tab]')];
  function selectTab(tab, focus = false) {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  // Only suggest supported desktop platforms. Keep both Mac architectures available.
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|CrOS/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const platform = mobile ? null : /Windows/.test(ua) ? 'windows' : /Macintosh/.test(ua) ? 'macos' : /Linux|X11/.test(ua) ? 'linux' : null;
  if (platform) document.querySelectorAll('[data-dlset]').forEach(set => {
    const match = set.querySelector(`[data-download="${platform}"]`);
    if (match) { match.classList.add('is-pick'); set.prepend(match); }
  });

  // A gold pill that glides behind whichever nav link has hover or focus, and rests under
  // the current page the rest of the time. Pure enhancement: the links work and read fine
  // without it (CSS alone still gives hover/current a colour change).
  const nav = document.querySelector('.nav');
  const navLinks = nav ? [...nav.querySelectorAll('.nav__top')] : [];
  if (nav && navLinks.length) {
    const pill = document.createElement('span');
    pill.className = 'nav__pill';
    nav.prepend(pill);
    const current = navLinks.find(a => a.hasAttribute('aria-current'));
    // Measured against the nav itself, not offsetLeft: dropdown triggers sit inside a
    // positioned .nav__item, so their offsetLeft is relative to that wrapper and reads ~0.
    const place = el => {
      if (!el) { pill.style.opacity = '0'; return; }
      pill.style.left = `${el.getBoundingClientRect().left - nav.getBoundingClientRect().left}px`;
      pill.style.width = `${el.offsetWidth}px`;
      pill.style.opacity = '1';
    };
    place(current);
    navLinks.forEach(a => {
      a.addEventListener('mouseenter', () => place(a));
      a.addEventListener('focus', () => place(a));
    });
    nav.addEventListener('mouseleave', () => place(current));
    nav.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget)) place(current); });
    addEventListener('resize', () => place(navLinks.find(a => a.matches(':hover')) || current));
    document.fonts?.ready.then(() => place(current));

    // Touch screens have no hover, so the first tap on a trigger opens its menu instead of
    // navigating; a second tap (or a tap elsewhere) behaves normally.
    const items = [...nav.querySelectorAll('.nav__item')];
    const closeAll = except => items.forEach(item => { if (item !== except) item.classList.remove('is-open'); });
    if (matchMedia('(hover: none)').matches) {
      items.forEach(item => {
        item.querySelector('.nav__trigger')?.addEventListener('click', event => {
          if (item.classList.contains('is-open')) return;
          event.preventDefault();
          closeAll(item);
          item.classList.add('is-open');
        });
      });
      document.addEventListener('click', event => { if (!nav.contains(event.target)) closeAll(); });
    }
    nav.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const item = event.target.closest('.nav__item');
      if (!item) return;
      closeAll();
      item.querySelector('.nav__trigger')?.focus();
      item.classList.add('is-dismissed');
    });
    items.forEach(item => {
      item.addEventListener('mouseleave', () => item.classList.remove('is-dismissed'));
      item.addEventListener('focusout', event => { if (!item.contains(event.relatedTarget)) item.classList.remove('is-dismissed'); });
    });
  }

  // Paint closed on arrival, then reveal only once the destination has loaded.
  // CSS supplies an opening fallback when JavaScript is disabled.
  const curtain = document.querySelector('.cloud-curtain');
  const reducedNav = matchMedia('(prefers-reduced-motion: reduce)');
  let navigating = false;
  curtain?.classList.add('is-managed');
  function openCurtain() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!navigating) curtain?.classList.add('is-open');
    }));
  }
  if (document.readyState === 'complete') openCurtain();
  else addEventListener('load', openCurtain, { once: true });

  document.addEventListener('click', async event => {
    if (!curtain || reducedNav.matches || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    // [data-download]/[data-dlset] links trigger a file download (Content-Disposition:
    // attachment), not a navigation — the document never unloads, so `navigating` would
    // never reset and the curtain would stay closed over the whole site until a reload.
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    if (link.hasAttribute('data-download') || link.closest('[data-dlset]')) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    curtain.classList.add('is-closing');
    curtain.classList.remove('is-open');
    // Wait for every staggered bank, including interrupted opening transitions.
    // Reading the animations flushes styles; their finished promises follow the
    // actual CSS duration, including reduced-motion changes during the animation.
    // Never let anything here throw past this point: `.is-closing` sets
    // pointer-events:auto on a full-viewport overlay, so if an exception skipped
    // the navigation below, the whole page would stay click-dead until reload.
    try {
      await Promise.allSettled((curtain.getAnimations?.({ subtree: true }) ?? []).map(animation => animation.finished));
    } catch { /* fall through and navigate anyway */ }
    location.assign(url.href);
    // Safety valve: if the document is still here shortly after (a link that triggers a
    // download or otherwise never unloads, rather than navigating), don't leave the curtain
    // covering the whole site until a manual reload — reopen it and let clicks work again.
    setTimeout(() => {
      if (!navigating) return;
      navigating = false;
      curtain.classList.remove('is-closing');
      openCurtain();
    }, 2000);
  });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    navigating = false;
    curtain?.classList.remove('is-closing');
    openCurtain();
  });

  // faq.html's live search: filters the plain <details> list client-side. With JS off the
  // input simply isn't there (it's injected by nothing — it's static markup) so every
  // question is already visible; this only ever hides, never requires itself to be useful.
  const faqSearch = document.querySelector('[data-faq-search]');
  const faqList = document.querySelector('[data-faq-list]');
  if (faqSearch && faqList) {
    const items = [...faqList.querySelectorAll('.faq__item')];
    const groups = [...faqList.querySelectorAll('.faq-group')];
    const empty = faqList.querySelector('[data-faq-empty]');
    faqSearch.addEventListener('input', () => {
      const q = faqSearch.value.trim().toLowerCase();
      let shown = 0;
      items.forEach(item => {
        const match = !q || item.textContent.toLowerCase().includes(q);
        item.hidden = !match;
        if (match) shown += 1;
      });
      groups.forEach(group => {
        group.hidden = q && ![...group.querySelectorAll('.faq__item')].some(item => !item.hidden);
      });
      empty?.classList.toggle('is-shown', shown === 0);
    });
  }
})();
