// Luma-dot background: a grid of dots whose size and tint follow an animated brightness field, in a
// violet palette. The field loops seamlessly every 8 seconds. Drawn on a canvas, paused off screen,
// and rendered as a single still frame when the visitor prefers reduced motion.
// Kept cheap on purpose: drawn at 1x resolution and about 15 frames a second, and on a device that
// cannot keep up it automatically uses fewer, larger dots instead of dropping frames.
(() => {
  const canvases = [...document.querySelectorAll('canvas.dots')]
  if (!canvases.length) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const LOOP = 8
  const STEPS = 8 // dot sizes per colour (see makeSprites)
  const PALETTE = ['#0b0720', '#2b2299', '#5b4cf5', '#8b7bff', '#bbaaff', '#ead6ff']

  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
  }
  const smooth = (t) => t * t * (3 - 2 * t)
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const u = smooth(x - xi), v = smooth(y - yi)
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  // t is the position in the loop, 0..1. Noise is sampled around a circle so the end meets the start.
  const field = (gx, gy, nx, ny, t) => {
    const a = 2 * Math.PI * t
    const cx = Math.cos(a) * 1.5, cy = Math.sin(a) * 1.5
    const n1 = noise(gx * 0.085 + cx, gy * 0.085 + cy)
    const n2 = noise(gx * 0.2 - cy * 1.4 + 7.3, gy * 0.2 + cx * 1.4 + 3.1)
    const dist = Math.hypot(nx - 0.5, (ny - 0.5) * 0.6)
    const pulse = Math.sin(2 * Math.PI * (dist * 1.6 - 2 * t))
    const v = 0.62 * n1 + 0.38 * n2 + 0.1 * pulse
    return Math.min(1, Math.max(0, (v - 0.5) * 1.9 + 0.5))
  }

  const instances = canvases.map((canvas) => {
    const ctx = canvas.getContext('2d')
    const base = Number(canvas.dataset.cell) || 16
    const inst = { canvas, ctx, base, cell: base, cost: 0, frames: 0, visible: true, cols: 0, rows: 0, idx: null, size: null, sprites: null, w: 0, h: 0 }
    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = 1 // soft round dots need no retina resolution, and it is a quarter of the pixels
      inst.w = Math.max(1, box.width)
      inst.h = Math.max(1, box.height)
      canvas.width = Math.round(inst.w * dpr)
      canvas.height = Math.round(inst.h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      inst.cols = Math.ceil(inst.w / inst.cell)
      inst.rows = Math.ceil(inst.h / inst.cell)
      inst.idx = new Uint8Array(inst.cols * inst.rows)
      inst.size = new Uint8Array(inst.cols * inst.rows)
      inst.sprites = makeSprites(inst.cell)
      draw(inst, (performance.now() / 1000 % LOOP) / LOOP)
    }
    inst.resize = resize
    new ResizeObserver(resize).observe(canvas)
    new IntersectionObserver(([entry]) => { inst.visible = entry.isIntersecting }).observe(canvas)
    resize()
    return inst
  })

  // One tiny pre-rendered circle per palette colour and size step. Stamping these is far cheaper than
  // building thousands of circle paths every frame, and the eight sizes are smooth enough to look continuous.
  function makeSprites(cell) {
    const sprites = []
    for (let c = 0; c < PALETTE.length; c++) {
      for (let k = 0; k < STEPS; k++) {
        const r = cell * (0.2 + 0.31 * (k / (STEPS - 1)))
        const d = Math.ceil(r * 2) + 2
        const sprite = document.createElement('canvas')
        sprite.width = sprite.height = d
        const g = sprite.getContext('2d')
        g.fillStyle = PALETTE[c]
        g.beginPath()
        g.arc(d / 2, d / 2, r, 0, Math.PI * 2)
        g.fill()
        sprites.push({ sprite, d })
      }
    }
    return sprites
  }

  function draw(inst, t) {
    const { ctx, cols, rows, cell, idx, size, sprites } = inst
    if (!cols || !rows) return
    ctx.clearRect(0, 0, inst.w, inst.h)
    for (let y = 0; y < rows; y++) {
      const py = (y + 0.5) * cell
      for (let x = 0; x < cols; x++) {
        const v = field(x, y, (x + 0.5) / cols, (y + 0.5) / rows, t)
        const i = y * cols + x
        idx[i] = Math.min(PALETTE.length - 1, Math.floor(v * PALETTE.length))
        size[i] = Math.round(v * (STEPS - 1))
        const s = sprites[idx[i] * STEPS + size[i]]
        ctx.drawImage(s.sprite, (x + 0.5) * cell - s.d / 2, py - s.d / 2)
      }
    }
  }

  if (reduced) { instances.forEach((inst) => draw(inst, 0.15)); return }
  let last = 0
  const frame = (now) => {
    requestAnimationFrame(frame)
    if (now - last < 66) return // about 15 frames a second is plenty for a soft pulse
    last = now
    const t = (now / 1000 % LOOP) / LOOP
    for (const inst of instances) {
      if (!inst.visible || document.hidden) continue
      const started = performance.now()
      draw(inst, t)
      const took = performance.now() - started
      // Judge the device only after warm-up (the first frames overlap page load), by a slow running average.
      if (++inst.frames > 20) inst.cost = inst.cost ? inst.cost * 0.92 + took * 0.08 : took
      // Genuinely too slow: use fewer, larger dots (up to twice the size) rather than janking.
      if (inst.frames > 75 && inst.cost > 14 && inst.cell < inst.base * 2) { inst.cell = Math.round(inst.cell * 1.25); inst.frames = 0; inst.cost = 0; inst.resize() }
    }
  }
  requestAnimationFrame(frame)
})()
