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
  const navLinks = nav ? [...nav.querySelectorAll('a')] : [];
  if (nav && navLinks.length) {
    const pill = document.createElement('span');
    pill.className = 'nav__pill';
    nav.prepend(pill);
    const current = navLinks.find(a => a.hasAttribute('aria-current'));
    const place = el => {
      if (!el) { pill.style.opacity = '0'; return; }
      pill.style.left = `${el.offsetLeft}px`;
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
    addEventListener('resize', () => place(nav.querySelector('a:hover') || current));
  }
})();
