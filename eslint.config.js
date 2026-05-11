// ESLint v9 flat config — 봉이 TM CRM
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-irregular-whitespace': 'off',
      'no-useless-escape': 'off',
      'no-async-promise-executor': 'warn',
      'no-fallthrough': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'client/dist/**',
      'docs/vendor/**',
      'server/public/**',
      '**/*.min.js',
      'playwright-report/**',
      'test-results/**',
      '.husky/**',
    ],
  },
];
