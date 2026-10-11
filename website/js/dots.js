// Luma-dot background: a grid of dots whose size and tint follow an animated brightness field, in a
// violet palette. The field loops seamlessly every 8 seconds. Drawn on a canvas, paused off screen,
// and rendered as a single still frame when the visitor prefers reduced motion.
(() => {
  const canvases = [...document.querySelectorAll('canvas.dots')]
  if (!canvases.length) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const LOOP = 8
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
    const inst = { canvas, ctx, cell: Number(canvas.dataset.cell) || 16, visible: true, cols: 0, rows: 0, idx: null, size: null, w: 0, h: 0 }
    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      inst.w = Math.max(1, box.width)
      inst.h = Math.max(1, box.height)
      canvas.width = Math.round(inst.w * dpr)
      canvas.height = Math.round(inst.h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      inst.cols = Math.ceil(inst.w / inst.cell)
      inst.rows = Math.ceil(inst.h / inst.cell)
      inst.idx = new Uint8Array(inst.cols * inst.rows)
      inst.size = new Float32Array(inst.cols * inst.rows)
      draw(inst, (performance.now() / 1000 % LOOP) / LOOP)
    }
    new ResizeObserver(resize).observe(canvas)
    new IntersectionObserver(([entry]) => { inst.visible = entry.isIntersecting }).observe(canvas)
    resize()
    return inst
  })

  function draw(inst, t) {
    const { ctx, cols, rows, cell, idx, size } = inst
    if (!cols || !rows) return
    ctx.clearRect(0, 0, inst.w, inst.h)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = field(x, y, (x + 0.5) / cols, (y + 0.5) / rows, t)
        const i = y * cols + x
        idx[i] = Math.min(PALETTE.length - 1, Math.floor(v * PALETTE.length))
        size[i] = cell * (0.2 + 0.31 * v)
      }
    }
    for (let c = 0; c < PALETTE.length; c++) {
      ctx.beginPath()
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          if (idx[i] !== c) continue
          const px = (x + 0.5) * cell, py = (y + 0.5) * cell
          ctx.moveTo(px + size[i], py)
          ctx.arc(px, py, size[i], 0, Math.PI * 2)
        }
      }
      ctx.fillStyle = PALETTE[c]
      ctx.fill()
    }
  }

  if (reduced) { instances.forEach((inst) => draw(inst, 0.15)); return }
  let last = 0
  const frame = (now) => {
    requestAnimationFrame(frame)
    if (now - last < 42) return // about 24 frames a second is plenty for a soft pulse
    last = now
    const t = (now / 1000 % LOOP) / LOOP
    for (const inst of instances) if (inst.visible && !document.hidden) draw(inst, t)
  }
  requestAnimationFrame(frame)
})()
