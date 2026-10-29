import js from '@eslint/js';
import globals from 'globals';

// The classic browser scripts (legacy/*, v4/v6 layers) share globals across
// files, so no-undef / no-unused-vars would only produce noise there. Lint
// still catches syntax errors and genuine bug patterns (duplicate keys,
// unreachable code, accidental assignments in conditions, etc.).
export default [
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'legacy/brand-assets.js'] },
  js.configs.recommended,
  {
    files: ['legacy/**/*.js', 'v4-modern.js', 'v6-enhancements.js', 'v7-features.js', 'v8-shell.js', 'v9-team.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, html2canvas: 'readonly' }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-inner-declarations': 'off',
      'no-redeclare': 'off'
    }
  },
  {
    files: ['src/**/*.js', 'server/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] }
  },
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, ...globals.node } }
  }
];
