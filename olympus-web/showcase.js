(() => {
  const slides = [
    ['code-preview', 'Olympus Code view with README.md open and the Aegean journal running in Live Preview.', 'Browse real project files alongside a running local preview.'],
    ['agent-working', 'Olympus showing the connected agent reading the sample project and returning a three-point summary.', 'A connected agent read README.md and index.html, then summarized the sample project.'],
    ['projects', 'Olympus project manager showing the Aegean journal and Cloud notes sample projects.', 'Keep separate projects together in the project library.']
  ];
  document.querySelectorAll('[data-showcase]').forEach(tour => {
    const buttons = [...tour.querySelectorAll('[data-tour-slide]')];
    const play = tour.querySelector('[data-tour-play]');
    let current = 0;
    let timer;
    function stop() {
      clearInterval(timer); timer = null;
      play.textContent = 'Play tour'; play.setAttribute('aria-pressed', 'false');
    }
    function show(index) {
      current = index;
      const [file, alt, caption] = slides[index];
      const img = tour.querySelector('[data-tour-image]');
      img.src = `assets/showcase/${file}.webp`; img.alt = alt;
      tour.querySelector('[data-tour-caption]').textContent = caption;
      tour.querySelector('[data-tour-full]').href = img.src;
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => { stop(); show(index); }));
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      play.textContent = 'Pause tour'; play.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => show((current + 1) % slides.length), 6000);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    tour.addEventListener('keydown', event => { if (event.key === 'Escape') stop(); });
  });
})();
