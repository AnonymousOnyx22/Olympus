// Flat ESLint config for Kern.
//
// NOTE ON THE FILE EXTENSION: this is `.js` using CommonJS `require`, because
// package.json has no `"type": "module"` and adding one would change how
// postcss.config.cjs, vite.config.ts and the CommonJS main-process bundle are
// all loaded. An ESM `eslint.config.js` would be parsed as CJS and throw on the
// first `import`.
//
// Design intent: catch real bugs (unreachable code, a misused hook, a floating
// promise) without becoming a style committee. Kern has no Prettier and no
// in-house style rules beyond what tsc already enforces, so every rule here
// either catches a defect or documents a deliberate exception.
//
// NOT enabled, and why:
//   - Formatting/indent rules: tsc and the editor handle that; a second
//     opinion here produces diff noise on files nobody is editing.
//   - @typescript-eslint/no-explicit-any: "warn", not "error". The OpencodeEvent
//     union models JSON arriving from a daemon we do not control, and `unknown`
//     plus narrowing casts read worse than `any` at those boundaries.
//   - react-hooks/exhaustive-deps: "warn", because the stream code closes over
//     refs and connection state deliberately. Turning it into an error would
//     mean restructuring working code to satisfy a linter.
//
// Run `npm run lint`. Warnings do not fail the script (--max-warnings is not
// set), so the bar is zero errors.
//
// ---------------------------------------------------------------------------
// TYPESCRIPT 7 vs typescript-eslint
// ---------------------------------------------------------------------------
// The project is on TypeScript 7 (the native port). typescript-eslint 8.x
// hard-refuses to load against it: its entry point reads ts.versionMajorMinor
// and throws "typescript-eslint does not support TS 7.0" for major >= 7.
// Upstream tracking is typescript-eslint#10940, and it is not resolved in the
// 8.71 release this repo pins.
//
// Rather than downgrade the compiler - the app typechecks clean on TS 7 and
// downgrading it would be a worse outcome than a lint shim - the block below
// makes `require('typescript')` resolve to ts6, the TypeScript 6 API installed
// alongside it. That is the side-by-side arrangement Microsoft's TS 7
// announcement recommends for this exact situation. TS 6 parses the project's
// syntax fine, which is all the linter needs: ESLint runs syntax rules, not
// type checking. `npm run typecheck` remains the authority for types, on TS 7.
//
// When typescript-eslint ships TS 7 support, delete ts6 from devDependencies
// and the whole shim with it. Nothing else in the repo depends on it.

// Redirect `require('typescript')` to the TS 6 copy (ts6) for the duration of
// this module's own requires. See the long note above for why. Module
// resolution is patched rather than the files in node_modules edited, so
// `npm ci` and `npm install` never undo it.
const Module = require('node:module')
const ts6Path = require.resolve('ts6')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request === 'typescript') return ts6Path
  return originalResolve.call(this, request, ...rest)
}

let js, globals, tseslint, reactHooks
try {
  js = require('@eslint/js')
  globals = require('globals')
  tseslint = require('typescript-eslint')
  reactHooks = require('eslint-plugin-react-hooks')
} finally {
  Module._resolveFilename = originalResolve
}

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'build/icon.*',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Kept at ERROR because they catch genuine defects: a hook called
      // conditionally or out of order corrupts React's internal state and the
      // app fails at runtime, not at build time. Both are clean today, so
      // there is no reason to weaken them.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/globals': 'error',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
      // setState during render is a genuine React bug: it discards the output
      // of the current render pass. Nothing in Kern does this today.
      'react-hooks/set-state-in-render': 'error',
      // Duplicates set-state-in-effect below, and would flag the same sites.
      'react-hooks/no-deriving-state-in-effects': 'off',

      // eslint-plugin-react-hooks v7 adds React Compiler rules. Kern does not use the compiler, and
      // the patterns they flag are deliberate and working, so they are off rather than left as
      // noise that hides real warnings:
      //
      //   refs                  Reading a ref during render is legal when it is not used to decide
      //     what to render. The hits are imperative wiring (xterm instances, ResizeObserver targets,
      //     "latest callback" refs).
      //   set-state-in-effect   The stream handler resets on session change, and the terminal
      //     creates its PTY when it becomes visible. That is synchronising with an external system
      //     (the daemon, the OS pty), which is what effects are for.
      //
      // Turn them on to hunt for refactors, not as a gate. exhaustive-deps stays a warning; the few
      // deliberate exceptions carry an inline disable with the reason.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/exhaustive-deps': 'warn',

      // --- correctness, high value -----------------------------------------
      // Unreachable code after a throw/return is almost always a refactor
      // leftover, and that is a real defect risk.
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      // A floating promise in the main process means an unhandled rejection at
      // startup, which shows the user a blank window and no explanation.
      'no-async-promise-executor': 'error',
      'no-return-await': 'error',
      // Fires in electron/projects.ts:10 on the Windows reserved-character
      // class, which deliberately spans the C0 control range (\u0000-\u001f) to
      // reject invalid Windows filenames. That is the point of the regex, not
      // a bug. Demoted to warn rather than suppressed inline, because the
      // source is owned elsewhere and an inline disable would have been lost.
      'no-control-regex': 'warn',

      // --- hygiene ---------------------------------------------------------
      // allowEmptyCatch because the settings and licence loaders catch-and-
      // return-a-default on purpose; a comment in the code explains why.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-var': 'error',

      // --- typescript ------------------------------------------------------
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // tsc --noEmit is the type authority and this config has no type
      // information, so the type-aware rules that would duplicate it are off.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Test fixtures deliberately build partial objects and pass through
      // shapes that are not the real types; the casts are the fixture.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    // CommonJS config files. package.json has no "type": "module", so these are
    // parsed as scripts and need the CJS globals declared, and require() is the
    // correct import style here rather than a style violation.
    files: ['**/*.cjs', '**/*.mjs', '**/*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
)
