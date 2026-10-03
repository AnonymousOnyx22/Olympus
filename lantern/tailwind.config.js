/** @type {import('tailwindcss').Config} */
// Olympus — "Aegean night": deep midnight navy, slate-blue panels, amber and cobalt light.
//
// Components are written in light-theme terms (bg-white card, slate-50 panel, text-slate-900
// title, aether-600 button). Rather than rewrite every class, the ramps below are remapped
// for a dark UI: low slate numbers are dark surfaces and high ones are light type, `white`
// is the card colour, and the tint ramps (amber/rose/emerald, plus aether in index.css) put
// dark tints at 50–200 and bright, readable type at 600–900. The roles stay the same.
//
//   app background   #0F172A  midnight     cards & panels   #1E293B  white
//   primary accent   #FACC15  amber-400    secondary accent #3B82F6  aether-500/600
//   primary text     #F8FAFC  slate-900    secondary text   #94A3B8  slate-500
const slate = {
  50: '#172235', 100: '#24324a', 200: '#334155', 300: '#475569', 400: '#7d8ca3',
  500: '#94a3b8', 600: '#cbd5e1', 700: '#e2e8f0', 800: '#f1f5f9', 900: '#f8fafc', 950: '#ffffff',
}
// Status tints: dark washes for backgrounds (50–200), the true hue in the middle, light type above.
const tint = (washes, mids, type) => ({
  50: washes[0], 100: washes[1], 200: washes[2], 300: mids[0], 400: mids[1], 500: mids[2],
  600: type[0], 700: type[1], 800: type[2], 900: type[3],
})
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        // Elevated float: panes, popovers, and the boot bar.
        aegean: '0 8px 24px rgb(2 6 23 / 0.45)',
        'aegean-lg': '0 24px 60px -12px rgb(2 6 23 / 0.7)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        // Aether Blue — the one accent, defined once in index.css as --accent-* channel
        // triplets so these utilities (and the shadows above) can carry an alpha value.
        aether: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
        },
        // Cards and panels. `text-white` is pinned back to crisp white in index.css so button
        // labels stay readable.
        white: '#1e293b',
        midnight: '#0f172a',
        slate,
        amber: tint(['#2a2310', '#3a2f12', '#5c4a14'], ['#fde047', '#facc15', '#eab308'], ['#fcd34d', '#fde68a', '#fef3c7', '#fffbeb']),
        rose: tint(['#2b1620', '#3d1a27', '#5f2335'], ['#fda4af', '#fb7185', '#f43f5e'], ['#fda4af', '#fecdd3', '#ffe4e6', '#fff1f2']),
        emerald: tint(['#0f2a24', '#123a30', '#165443'], ['#6ee7b7', '#34d399', '#10b981'], ['#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5']),
        // Helios Gold — review/approval + critical warnings only.
        helios: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      keyframes: {
        'olympus-pulse': { '0%, 100%': { opacity: '0.55', transform: 'scale(0.82)' }, '50%': { opacity: '1', transform: 'scale(1)' } },
        'olympus-drift': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(400%)' } },
        // The two halves of the track are identical, so a -50% translate loops invisibly.
        'olympus-marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        pulse: 'olympus-pulse 1s ease-in-out infinite',
        drift: 'olympus-drift 1.6s ease-in-out infinite',
        marquee: 'olympus-marquee 28s linear infinite',
      },
    },
  },
  plugins: [],
}
