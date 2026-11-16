// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'max-params': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true, ignoreDefaultValues: true, ignoreTypeIndexes: true },
      ],
    },
  },
  {
    // Serverfunktionerna körs i Deno hos Supabase.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  },
  {
    files: ['**/*.test.ts', 'eslint.config.js'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
);
