// Drawing helpers shared by the advert pages. An advert defines window.draw(t) and window.DURATION; the
// renderer (src/render-ad.mjs) steps through it frame by frame, so everything must depend on t alone.
const ICONS = {}
const c = document.getElementById('c'), x = c.getContext('2d')
const W = 1080, H = 1920
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ramp = (t, start, len) => clamp((t - start) / len)
const outCubic = (p) => 1 - Math.pow(1 - p, 3)
const outBack = (p) => { const s = 1.5; p -= 1; return p * p * ((s + 1) * p + s) + 1 }
const VIOLET = '#8b7bff', LAV = '#c9b8ff', TEXT = '#f2f2f2', MUTED = '#9a9a9a', PANE = '#1e1e1e', LINE = '#343434'
const OK = '#34d399', WARN = '#facc15', BAD = '#fb7185'

function text(str, cx, y, size, weight, color, alpha = 1, align = 'center', family = '"Segoe UI", system-ui, sans-serif') {
  x.save(); x.globalAlpha = clamp(alpha); x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic'
  x.font = `${weight} ${size}px ${family}`; x.fillText(str, cx, y); x.restore()
}
const rrect = (px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r) }

function dotGrid(t) {
  const gap = 48
  for (let gy = gap / 2; gy < H; gy += gap) for (let gx = gap / 2; gx < W; gx += gap) {
    const d = Math.hypot(gx - W / 2, gy - H / 2)
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 - d * 0.006)
    x.globalAlpha = 0.06 + 0.16 * pulse * (1 - clamp(d / 1300))
    x.fillStyle = VIOLET; x.beginPath(); x.arc(gx, gy, 2 + 2.4 * pulse, 0, 7); x.fill()
  }
  x.globalAlpha = 1
}

function mark(cx, cy, size, alpha = 1) {
  x.save(); x.globalAlpha = clamp(alpha); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 40, size / 40)
  rrect(0, 0, 40, 40, 6); x.fillStyle = '#181818'; x.fill(); x.lineWidth = 1; x.strokeStyle = LINE; x.stroke()
  x.strokeStyle = TEXT; x.lineWidth = 4; x.lineJoin = 'miter'
  x.stroke(new Path2D('M9 7v26M30 7 17 20l13 13')); x.stroke(new Path2D('M9 20h8'))
  x.restore()
}

function icon(name, cx, cy, size, color, alpha = 1) {
  const d = ICONS[name]; if (!d) return
  x.save(); x.globalAlpha = clamp(alpha); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 24, size / 24)
  x.fillStyle = color; x.fill(new Path2D(d)); x.restore()
}

/** The closing card every advert ends on, so the status is always stated the same honest way. */
function endCard(t, start) {
  const f = ramp(t, start, 0.5); if (f <= 0) return
  mark(W / 2, 640, 160, f)
  text('Early beta.', W / 2, 960, 120, 800, TEXT, f)
  text('Not public yet.', W / 2, 1090, 120, 800, VIOLET, f)
  text('Follow to watch it come together.', W / 2, 1250, 44, 400, MUTED, f)
  const g = 0.5 + 0.5 * Math.sin(t * 4)
  x.globalAlpha = f * (0.5 + 0.5 * g); x.fillStyle = VIOLET; x.beginPath(); x.arc(W / 2, 1380, 14, 0, 7); x.fill(); x.globalAlpha = 1
}

window.setIcons = (icons) => Object.assign(ICONS, icons)
