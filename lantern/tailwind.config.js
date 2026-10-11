/** @type {import('tailwindcss').Config} */
// Charcoal app surfaces; legacy utility names stay compatible with existing components.
const slate = {
  50: '#202020', 100: '#282828', 200: '#343434', 300: '#777777', 400: '#929292',
  500: '#b0b0b0', 600: '#c6c6c6', 700: '#dedede', 800: '#e8e8e8', 900: '#f2f2f2', 950: '#ffffff',
}
// Status tints: dark washes for backgrounds (50 to 200), the true hue in the middle, light type above.
const tint = (washes, mids, type) => ({
  50: washes[0], 100: washes[1], 200: washes[2], 300: mids[0], 400: mids[1], 500: mids[2],
  600: type[0], 700: type[1], 800: type[2], 900: type[3],
})
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: { sm: '4px', DEFAULT: '4px', md: '4px', lg: '6px', xl: '6px', '2xl': '8px', '3xl': '12px' },
      boxShadow: {
        // Elevated float: panes, popovers, and the boot bar.
        float: 'none',
        'float-lg': '0 4px 16px rgb(0 0 0 / 0.24)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        // The one accent, defined once in index.css as --accent-* channel triplets so these
        // utilities (and the shadows above) can carry an alpha value.
        accent: {
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
        white: '#202020',
        midnight: '#181818',
        slate,
        amber: tint(['#2a2310', '#3a2f12', '#5c4a14'], ['#fde047', '#facc15', '#eab308'], ['#fcd34d', '#fde68a', '#fef3c7', '#fffbeb']),
        rose: tint(['#2b1620', '#3d1a27', '#5f2335'], ['#fda4af', '#fb7185', '#f43f5e'], ['#fda4af', '#fecdd3', '#ffe4e6', '#fff1f2']),
        emerald: tint(['#0f2a24', '#123a30', '#165443'], ['#6ee7b7', '#34d399', '#10b981'], ['#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5']),
      },
      keyframes: {
        'kern-pulse': { '0%, 100%': { opacity: '0.55', transform: 'scale(0.82)' }, '50%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        pulse: 'kern-pulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
