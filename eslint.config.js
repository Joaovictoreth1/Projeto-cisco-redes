import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Build DOM with h()/textContent; never parse strings as HTML.' },
        { property: 'outerHTML', message: 'Build DOM with h()/textContent; never parse strings as HTML.' },
        { property: 'insertAdjacentHTML', message: 'Build DOM with h()/textContent; never parse strings as HTML.' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['tests/**', 'e2e/**', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  { files: ['*.js'], ...tseslint.configs.disableTypeChecked },
);
