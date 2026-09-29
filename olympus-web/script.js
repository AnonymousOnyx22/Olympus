/* Olympus: site behaviour.

   This file used to drive 38 scrubbed elements, one per block on the page.
   That was far too much: every card, every step and every requirement row
   moved on its own clock, so scrolling read as a page twitching rather than
   as a page being read. It now drives a small, coordinated set of things:

     1. The frieze on the home page. The sun's rays turn, the temple
        settles, and the mountain ranges drift at different rates as the
        band passes.
     2. The column pinned to the edge of the page. Gold fills it with
        reading progress, and it leans with the direction you are going.
     3. The site-wide reveal. Cards, panels, steps and the page head settle
        into place the first time each one enters the viewport, on every
        page, not only the home page.

   Everything else in the site is CSS. Nothing here is required for the page
   to be read, and with scripting off the site is fully static.

   The first two are pure functions of scroll position, so scrolling back up
   plays them backwards instead of latching. The third fires once per element
   and stops, which is the right shape for an entrance rather than a scrub.

   Two small additions since: the download buttons are ordered by
   `navigator.userAgent`, and a no-op analytics dispatcher announces
   interactions as `olympus:analytics` CustomEvents. Neither sends anything
   anywhere. See the comment above each. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var isOff = function () { return reduced.matches; };

  var doc = document.documentElement;
  var bar = document.getElementById('site-bar');

  /* ── The one scroll pass ────────────────────────────────────────────── */
  /* `--pg` is page progress and `--vel` is signed, smoothed scroll velocity.
     `--p` is per-element progress and is only ever set on `[data-scrub]`,
     which today is the frieze and nothing else. */

  var scrubs = [].slice.call(document.querySelectorAll('[data-scrub]'));
  var tracks = scrubs.map(function (el) {
    return {
      el: el,
      /* `hold` completes across a short band near the lower third of the
         screen rather than across the element's whole travel, so the rays
         are fully turned by the time the band is centred. */
      hold: el.getAttribute('data-scrub') === 'hold',
      top: 0,
      h: 0,
      last: -2
    };
  });

  var vh = 1;
  var range = 1;
  var lastY = 0;
  var vel = 0;
  var want = 0;
  var stuck = null;
  var queued = false;
  /* Under reduced motion the pass still measures, but every value is pinned
     to 1 so the page reads as its finished state. */
  var live = !isOff();

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  function measure() {
    vh = window.innerHeight || 1;
    range = Math.max(1, doc.scrollHeight - vh);
  }

  function frame() {
    queued = false;

    var y = window.scrollY || doc.scrollTop || 0;
    var dy = y - lastY;
    lastY = y;

    want = dy === 0 ? 0 : clamp01(Math.abs(dy) / (vh * 0.5)) * (dy < 0 ? -1 : 1);
    vel += (want - vel) * (live ? 0.14 : 1);
    if (Math.abs(vel) < 0.0005) vel = 0;

    /* ---- reads, gathered first so no write can force a mid-loop layout -- */
    for (var i = 0; i < tracks.length; i += 1) {
      var box = tracks[i].el.getBoundingClientRect();
      tracks[i].top = box.top;
      tracks[i].h = box.height;
    }

    /* ---- writes ---- */
    if (bar && stuck !== (y > 8)) {
      stuck = y > 8;
      bar.classList.toggle('is-stuck', stuck);
    }

    doc.style.setProperty('--pg', (range > 0 ? clamp01(y / range) : 0).toFixed(5));
    doc.style.setProperty('--vel', vel.toFixed(4));

    for (var j = 0; j < tracks.length; j += 1) {
      var t = tracks[j];
      var p;
      if (!live) {
        p = 1;
      } else if (t.hold) {
        p = clamp01((vh * 0.86 - t.top) / (vh * 0.42));
      } else {
        /* 0 as the element arrives at the bottom edge, 1 once its bottom
           has cleared the top of the screen. */
        p = clamp01((vh - t.top) / (vh + t.h));
      }
      if (Math.abs(p - t.last) < 0.0015) continue;
      t.last = p;
      t.el.style.setProperty('--p', p.toFixed(4));
    }
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    measure();
    onScroll();
  }, { passive: true });

  /* ── Mobile navigation ─────────────────────────────────────────────── */
  /* The toggle is a real button, so Enter and Space work for free; Escape
     closes it and returns focus. */
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel = document.getElementById('mobile-nav');

  if (toggle && panel) {
    var isOpen = function () {
      return toggle.getAttribute('aria-expanded') === 'true';
    };
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      panel.setAttribute('data-open', String(open));
    };

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (isOpen() && !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    /* The panel is a `display: none` region on small screens, which also
       takes its links out of the tab order. Close it when the viewport grows. */
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* ── Entrance ───────────────────────────────────────────────────────── */
  /* Two separate things, because the inner pages have no hero: the header's
     zigzag bar draws in on every page, and the home page's hero copy rises
     in on top of it. Neither is scroll-linked; both play once. */
  var hero = document.querySelector('[data-hero]');

  var enter = function () {
    if (bar) bar.classList.add('is-in');
    if (hero) hero.classList.add('is-in');
  };
  window.requestAnimationFrame(function () { window.requestAnimationFrame(enter); });
  /* A backstop, so a throttled rAF can never leave the header bar blank. */
  window.setTimeout(enter, 1500);

  /* ── Site-wide reveal ──────────────────────────────────────────────────
     The home page's card grids already settle in via the scroll pass above
     (`--p`, written onto `[data-reveal]`'s ancestor). Every inner page has
     the same kind of content, a page head, cards, a panel, a row of steps,
     the FAQ list, with no entrance at all. This adds one, generically:
     watch a fixed list of content blocks and add `is-inview` the first time
     each one crosses into view. CSS does the rest (20a in styles.css).

     Anything already inside [data-reveal] is skipped, so nothing is ever
     driven by both mechanisms at once. Runs once per element, then stops
     watching it, this is an entrance, not a loop. */
  if (!isOff() && 'IntersectionObserver' in window) {
    var revealAll = [].slice.call(document.querySelectorAll(
      '.sec__head, .card, .card-lg, .panel, .steps .step, .cmp__fig, .faq__item, .pagehead, .price__cta, .note, .rel__item'
    ));
    var revealTargets = [];
    for (var rv = 0; rv < revealAll.length; rv += 1) {
      if (!revealAll[rv].closest('[data-reveal]')) revealTargets.push(revealAll[rv]);
    }
    for (var rt = 0; rt < revealTargets.length; rt += 1) {
      revealTargets[rt].classList.add('reveal');
      revealTargets[rt].style.setProperty('--rd', ((rt % 6) * 55) + 'ms');
    }
    var revealIo = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e += 1) {
        if (!entries[e].isIntersecting) continue;
        entries[e].target.classList.add('is-inview');
        revealIo.unobserve(entries[e].target);
      }
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    for (var ro = 0; ro < revealTargets.length; ro += 1) revealIo.observe(revealTargets[ro]);
  }

  /* ── The cards answer the pointer ───────────────────────────────────── */
  /* Not scroll, not a timer: a cornice on the top edge and a sill on the
     bottom one fill toward the cursor, so the ornament tracks the pointer
     and drains away when it leaves. */
  if (fine.matches && !isOff()) {
    var cards = [].slice.call(document.querySelectorAll('.card, .card-lg'));
    for (var c = 0; c < cards.length; c += 1) {
      (function (card) {
        card.addEventListener('pointermove', function (event) {
          var box = card.getBoundingClientRect();
          if (!box.width) return;
          card.style.setProperty('--cx', ((event.clientX - box.left) / box.width).toFixed(3));
        }, { passive: true });
        card.addEventListener('pointerleave', function () {
          card.style.setProperty('--cx', '0');
        });
      }(cards[c]));
    }
  }

  /* ── Hero mock window: pointer tilt ─────────────────────────────────── */
  var tilt = document.querySelector('[data-tilt]');
  if (tilt && fine.matches && !isOff()) {
    var level = function () { tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); };
    tilt.addEventListener('pointermove', function (event) {
      var box = tilt.getBoundingClientRect();
      tilt.style.setProperty('--rx', (((event.clientY - box.top) / box.height - 0.5) * -3).toFixed(2) + 'deg');
      tilt.style.setProperty('--ry', (((event.clientX - box.left) / box.width - 0.5) * 3).toFixed(2) + 'deg');
    }, { passive: true });
    tilt.addEventListener('pointerleave', level);
  }

  /* ── Hero mock window: the approval loop ────────────────────────────── */
  /* Script only moves `data-state` and flips one class per diff line; the
     pulses, the tick and the label swap are all CSS. It runs only while the
     figure is on screen, and never under reduced motion. */
  var shot = document.querySelector('[data-shot]');
  if (shot && !isOff() && 'IntersectionObserver' in window) {
    var rows = [].slice.call(shot.querySelectorAll('[data-seq]'));
    var timers = [];
    var cursor = 0;
    var running = false;

    var setState = function (name) { shot.setAttribute('data-state', name); };
    var clearRows = function () {
      for (var i = 0; i < rows.length; i += 1) rows[i].classList.remove('is-on');
    };
    var showRow = function (i) { if (rows[i]) rows[i].classList.add('is-on'); };

    var cycle = [
      { w: 400,  fn: function () { setState('idle'); clearRows(); } },
      { w: 500,  fn: function () { setState('streaming'); } },
      { w: 560,  fn: function () { showRow(0); } },
      { w: 420,  fn: function () { showRow(1); } },
      { w: 420,  fn: function () { showRow(2); } },
      { w: 420,  fn: function () { showRow(3); } },
      { w: 700,  fn: function () { setState('pending'); } },
      { w: 2400, fn: null },
      { w: 160,  fn: function () { setState('approved'); } },
      { w: 2900, fn: null }
    ];

    var halt = function () {
      running = false;
      for (var i = 0; i < timers.length; i += 1) window.clearTimeout(timers[i]);
      timers = [];
    };

    var advance = function () {
      if (!running) return;
      var item = cycle[cursor];
      cursor = (cursor + 1) % cycle.length;
      if (item.fn) item.fn();
      timers.push(window.setTimeout(advance, item.w));
    };

    var play = function () {
      if (running) return;
      running = true;
      cursor = 0;
      advance();
    };

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) play(); else halt();
      });
    }, { threshold: 0.25 }).observe(shot);

    /* Honour the OS setting if it is flipped while the page is open. */
    if (reduced.addEventListener) {
      reduced.addEventListener('change', function () {
        if (isOff()) { halt(); clearRows(); setState('idle'); } else play();
      });
    }
  }

  /* ── The transcript replay ───────────────────────────────────────────── */
  /* The one piece of motion on this site that runs on a clock rather than on
     scroll. The page's whole argument is that you can watch an agent work, so
     the site demonstrates it rather than describing it.

     The steps are the real sequence the app produces for an ordinary
     request: a prompt, streamed reasoning, a search, a read, an edit held
     behind an approval, a test run. It is labelled as a replay in the
     caption, because that is exactly what it is.

     Three rules this obeys, in order of importance:

       1. Nothing here is required to read the page. Every step is in the
          source, visible by default. The controller only ADDS `is-playing`,
          which is what starts hiding the steps that have not arrived. No
          script, or reduced motion, means a complete static transcript.
       2. The reader can always take over. Hovering or focusing the panel
          stops the clock; any tool row can be opened at any time; Allow and
          Replay are real buttons.
       3. It cannot get stuck. If nobody touches the approval, it approves
          itself after a generous dwell and the loop continues. A demo that
          freezes is worse than no demo. */
  (function () {
    var shot = document.querySelector('[data-transcript]');
    if (!shot) return;

    var steps = [].slice.call(shot.querySelectorAll('[data-at]'));
    if (!steps.length) return;

    var stateEl = shot.querySelector('[data-transcript-state]');
    var replayBtn = shot.querySelector('[data-transcript-replay]');
    var allowBtn = shot.querySelector('[data-transcript-allow]');
    var denyBtn = shot.querySelector('[data-transcript-deny]');
    var rows = [].slice.call(shot.querySelectorAll('.tr__row'));
    var triggers = [].slice.call(shot.querySelectorAll('.tr__trigger'));

    /* Milliseconds to hold each step. The gaps are the timing: the pause
       before the edit is what makes the approval land. */
    var script = [
      { i: 0, w: 800 },
      { i: 1, w: 2100 },
      { i: 2, w: 900 },
      { i: 3, w: 1000 },
      { i: 4, w: 900 },
      { i: 5, w: 1400 },
      { i: 6, w: 3000 },
      { i: 7, w: 900 },
      { i: 8, w: 1300 }
    ];
    var TAIL = 3600; /* held at the end before looping */
    var MAX_DWELL = 7000; /* nobody answered the approval: decide for them */

    var timers = [];
    var cursor = 0;
    var playing = false;
    var paused = false;
    var approved = false;
    /* Set the moment the approval is resolved, by either route. Without it
       the auto-approve safety net fires after a manual Deny and advances the
       timeline a second time, which double-schedules every later step. */
    var resolved = false;

    function clearTimers() {
      for (var i = 0; i < timers.length; i += 1) window.clearTimeout(timers[i]);
      timers = [];
    }

    function later(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }

    function label(text) {
      shot.classList.remove('is-thinking', 'is-working', 'is-waiting');
      if (text) shot.classList.add(text);
      if (stateEl) stateEl.textContent = text === 'is-thinking' ? 'thinking'
        : text === 'is-waiting' ? 'needs you'
        : text === 'is-working' ? 'working' : 'idle';
    }

    function reveal(index) {
      for (var s = 0; s < steps.length; s += 1) {
        if (Number(steps[s].getAttribute('data-at')) <= index) steps[s].classList.add('is-in');
      }
    }

    function approve(auto) {
      if (resolved) return;
      resolved = true;
      approved = true;
      shot.classList.add('is-approved');
      for (var r = 0; r < rows.length; r += 1) {
        if (rows[r].querySelector('.tr__wait')) rows[r].classList.add('is-done');
      }
      label('is-working');
      if (auto) track('transcript_auto_allow', { step: 'approval' });
      else track('transcript_allow', { step: 'approval' });
      /* Move on immediately rather than waiting out the dwell: the reader
         answered, and keeping the gate on screen after that is a fib. */
      later(function () { step(7); }, 420);
    }

    function step(next) {
      if (!playing) return;
      if (next >= script.length) {
        later(function () { if (playing) run(); }, TAIL);
        return;
      }
      var item = script[next];
      cursor = next;

      if (item.i === 1) label('is-thinking');
      else if (item.i === 2) label('is-working');
      else if (item.i === 6) label('is-waiting');
      reveal(item.i);
      later(function () { step(next + 1); }, item.w);
      /* The gate is the only step that can be stuck, so it is the only one
         that gets its own safety net. */
      if (item.i === 6) later(function () { approve(true); }, MAX_DWELL);
    }

    function run() {
      clearTimers();
      approved = false;
      resolved = false;
      cursor = 0;
      shot.classList.remove('is-approved', 'is-denied', 'is-working', 'is-thinking', 'is-waiting');
      for (var s = 0; s < steps.length; s += 1) steps[s].classList.remove('is-in');
      for (var r = 0; r < rows.length; r += 1) rows[r].classList.remove('is-done', 'is-refused', 'is-open');
      /* Collapsed again, so a replay reads as a replay rather than as the
         settled state left behind by a previous run or by reduced motion. */
      for (var t = 0; t < triggers.length; t += 1) triggers[t].setAttribute('aria-expanded', 'false');
      later(function () { step(0); }, 260);
    }

    function play() {
      if (playing || isOff()) return;
      playing = true;
      paused = false;
      shot.classList.add('is-playing');
      run();
    }

    function halt() {
      playing = false;
      paused = false;
      clearTimers();
      shot.classList.remove('is-playing', 'is-working', 'is-thinking', 'is-waiting');
      /* Leaving the finished state in place rather than clearing it, so
         scrolling past does not make the panel blink out. */
      label(null);
    }

    /* Under reduced motion: never start, and make sure every step is present
       with its output open, in case the user flips the OS setting off while
       the page is open. The panel becomes a plain, complete, readable
       transcript, which is the right thing for a reader who asked for less
       movement, not a worse version of the same thing. */
    function settle() {
      for (var s = 0; s < steps.length; s += 1) steps[s].classList.add('is-in');
      for (var r = 0; r < rows.length; r += 1) {
        rows[r].classList.add('is-done', 'is-open');
        var trigger = rows[r].querySelector('.tr__trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      }
      label(null);
    }

    /* ---- interaction ---- */

    /* Every tool row opens at any time, playing or not. A boolean class rather
       than <details>, because the row also has to stay a single line while
       it is closed and the app collapses them all the same way.

       `is-collapsible` is the one-way switch that makes the outputs start
       hidden. The CSS shows them by default, so a reader without scripting
       gets the whole transcript including the output, which is the content
       the section is actually about. */
    shot.classList.add('is-collapsible');
    for (var t = 0; t < triggers.length; t += 1) {
      (function (trigger, row) {
        trigger.addEventListener('click', function () {
          var open = row.classList.toggle('is-open');
          trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
          var name = row.querySelector('.tr__name');
          track('transcript_row', { tool: (name || {}).textContent || null, open: open });
        });
      }(triggers[t], triggers[t].parentNode));
    }

    if (allowBtn) allowBtn.addEventListener('click', function () { approve(false); });
    if (denyBtn) {
      denyBtn.addEventListener('click', function () {
        /* Guard first, for the same reason as approve(): the dwell timer may
           already be in flight. */
        if (resolved) return;
        resolved = true;
        track('transcript_deny', { step: 'approval' });
        /* Denying does not stall the demo: the row is marked refused and the
           sequence carries on, which is what actually happens in the app. */
        shot.classList.add('is-denied');
        shot.classList.remove('is-waiting');
        for (var r = 0; r < rows.length; r += 1) {
          if (rows[r].querySelector('.tr__wait')) rows[r].classList.add('is-refused');
        }
        label('is-working');
        later(function () { step(7); }, 500);
      });
    }
    if (replayBtn) replayBtn.addEventListener('click', function () { track('transcript_replay', {}); play(); });

    /* Hovering or focusing hands control to the reader. focus-within matters
       as much as hover: someone tabbing through the rows is reading. */
    shot.addEventListener('mouseenter', function () { paused = true; clearTimers(); });
    shot.addEventListener('mouseleave', function () {
      if (!paused) return;
      paused = false;
      if (playing) step(cursor + 1);
    });
    shot.addEventListener('focusin', function () { paused = true; clearTimers(); });
    shot.addEventListener('focusout', function () {
      if (!paused) return;
      /* Only resume when focus has genuinely left the panel. */
      window.setTimeout(function () {
        if (shot.contains(document.activeElement)) return;
        paused = false;
        if (playing) step(cursor + 1);
      }, 0);
    });

    /* Runs only while it is on screen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e += 1) {
          if (entries[e].isIntersecting) { if (!playing) play(); }
          else if (playing) halt();
        }
      }, { threshold: 0.3 }).observe(shot);
    } else {
      settle();
    }

    if (reduced.addEventListener) {
      reduced.addEventListener('change', function () {
        if (isOff()) { halt(); settle(); } else play();
      });
    }

    if (isOff()) settle();
  }());

  /* ── Analytics hook ─────────────────────────────────────────────────── */
  /* A no-op by default, on purpose. There is no tracker in this file and
     there never should be: the product's claim is that nothing leaves your
     machine, and a site that ships a third-party pixel would be quietly
     making that claim untrue about itself.

     What it does instead is announce meaningful interactions as a
     CustomEvent on `document`, so a self-hosted or privacy-respecting
     tool can be wired in later without editing any of the call sites:

       document.addEventListener('olympus:analytics', function (e) {
         // e.detail = { name: 'download', props: { os: 'macos' }, page: '/' }
       });

     Every event also goes to console.debug, so you can watch the page's
     interactions in devtools with no tooling at all. */
  var track = function (name, props) {
    var detail = {
      name: name,
      props: props || {},
      page: window.location.pathname
    };
    if (window.console && window.console.debug) {
      window.console.debug('[olympus:analytics]', detail);
    }
    try {
      document.dispatchEvent(new CustomEvent('olympus:analytics', { detail: detail }));
    } catch (err) {
      /* A browser without CustomEvent still gets the console line. */
    }
  };

  /* Anything marked `data-track` reports itself. Attributes:
       data-track        event name
       data-track-os     set from the nearest [data-download], for downloads
       data-faq          set from the nearest [data-faq], for questions      */
  var tracked = [].slice.call(document.querySelectorAll('[data-track]'));
  for (var k = 0; k < tracked.length; k += 1) {
    (function (el) {
      el.addEventListener('click', function () {
        var props = {};
        var dl = el.closest('[data-download]');
        if (dl) props.os = dl.getAttribute('data-download');
        var faq = el.closest('[data-faq]');
        if (faq) props.question = faq.getAttribute('data-faq');
        if (!el.getAttribute('href') || el.getAttribute('href').charAt(0) !== '#') {
          props.outbound = el.getAttribute('href') || null;
        }
        track(el.getAttribute('data-track'), props);
      });
    }(tracked[k]));
  }

  /* Nav clicks are worth knowing about separately from everything else,
     because they are the only signal that a page was not enough. */
  var navLinks = [].slice.call(document.querySelectorAll('.nav a, .mobilenav a, .foot__nav a, .foot__col a, .pager a'));
  for (var n = 0; n < navLinks.length; n += 1) {
    (function (link) {
      link.addEventListener('click', function () {
        track('nav', { to: link.getAttribute('href'), label: (link.textContent || '').trim() });
      });
    }(navLinks[n]));
  }

  /* The FAQ is <details>, so the only event worth reporting is a toggle,
     and only the ones being opened. */
  var answers = [].slice.call(document.querySelectorAll('details.faq__item'));
  for (var d = 0; d < answers.length; d += 1) {
    (function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        track('faq_open', {
          question: item.getAttribute('data-faq') || null,
          label: (item.querySelector('summary') || {}).textContent || null
        });
      });
    }(answers[d]));
  }

  /* ── Download buttons: put the reader's own platform first ─────────── */
  /* The three buttons are always all three. All this does is move the one
     that matches and mark it, so somebody on a Mac is not reading past
     Windows to find it. Without scripting the three stay in the order they
     are written in, which is macOS, Windows, Linux.

     There is deliberately no platform sniffing beyond the user agent
     string, and no network request of any kind: `navigator.userAgent` is
     local, and this file sends nothing. */
  var platform = (function () {
    var ua = window.navigator.userAgent || '';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
    if (/X11|Linux|Android|CrOS/i.test(ua)) return 'linux';
    return null;
  }());

  if (platform) {
    var sets = [].slice.call(document.querySelectorAll('[data-dlset]'));
    for (var s = 0; s < sets.length; s += 1) {
      var match = sets[s].querySelector('[data-download="' + platform + '"]');
      if (!match) continue;
      match.classList.add('is-pick');
      /* Reordered in the DOM rather than with `order`, so the visual order
         and the tab order never disagree. Done before first paint. */
      if (sets[s].firstElementChild !== match) {
        sets[s].insertBefore(match, sets[s].firstChild);
      }
    }
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  measure();
  onScroll();
  /* Web fonts change every measurement on the page, so re-measure once they
     have landed. */
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { measure(); onScroll(); });
  window.addEventListener('load', function () { measure(); onScroll(); });
  window.setTimeout(function () { measure(); onScroll(); }, 400);
}());
