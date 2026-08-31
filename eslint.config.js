// ESLint 9 flat config. Lenient on purpose: recommended JS + TS rule sets
// (no type-aware rules) plus the two React hooks rules. Tighten later once
// the existing warnings are worked off.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '.claude/**',
    '.vercel/**',
    'playwright-report/**',
    'test-results/**',
    // Throwaway HTML mockups, static assets and non-app helpers.
    '_mockups/**',
    'mockups/**',
    'public/**',
    'docs/**',
    'plans_md/**',
    'youtube-proxy-helper/**',
    // Stray TS emit (Vercel builds functions from source).
    'api/**/*.js',
    'src/**/*.js',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    name: 'dashboard/shared',
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    name: 'dashboard/browser',
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    name: 'dashboard/node',
    files: [
      'api/**/*.ts',
      'tests/**/*.ts',
      'screenshots/**/*.mjs',
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
]);
