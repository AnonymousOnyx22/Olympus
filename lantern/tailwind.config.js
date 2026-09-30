/** @type {import('tailwindcss').Config} */
// Olympus — "Aegean Greek High-Tech": a pristine, elevated, airy light system.
//
// The palette is deliberately built from Tailwind's stock `slate` (surfaces + type),
// Aether Blue (the single accent, exposed as the `aether-*` utilities) and `amber`
// (Helios Gold, reserved for the review/approval state and critical warnings). There is
// no `gray` ramp and no legacy `ink`/`glow` alias — the surface and accent roles are
// expressed directly, so every utility in the app names the intent (slate-50 panel,
// aether-600 link) rather than a numbered surface token.
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        // Elevated float: panes, popovers, and the boot bar.
        aegean: '0 8px 30px rgb(var(--accent-500) / 0.08)',
        'aegean-lg': '0 20px 50px -12px rgb(var(--accent-500) / 0.22)',
      },
      fontFamily: {
        sans: ['Times New Roman', 'Times', 'Georgia', 'serif'],
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
      },
      animation: {
        pulse: 'olympus-pulse 1s ease-in-out infinite',
        drift: 'olympus-drift 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
