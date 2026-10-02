
/* Accordion fallback for engines without ::details-content. Height is measured, animated,
   then released to auto so a long answer is never permanently clipped. */
(function () {
  var items = document.querySelectorAll('.faq__item');
  if (!items.length) return;
  var supported = CSS.supports('selector(::details-content)');
  if (supported) return; // the native path is doing the work
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (var i = 0; i < items.length; i += 1) {
    (function (d) {
      var answer = d.querySelector('.faq__answer') || (d.querySelector('summary') || {}).nextElementSibling;
      if (!answer) return;
      d.classList.add('is-animating');
      d.addEventListener('toggle', function () {
        answer.style.height = 'auto';
        var full = answer.offsetHeight;
        answer.style.height = d.open ? '0px' : full + 'px';
        // force a reflow so the transition has a start value to move from
        void answer.offsetHeight;
        answer.style.height = d.open ? full + 'px' : '0px';
        window.setTimeout(function () {
          if (d.open) { answer.style.height = 'auto'; d.classList.remove('is-animating'); }
        }, 440);
      });
    }(items[i]));
  }
}());

