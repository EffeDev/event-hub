// Package-specific ESLint configuration
import baseConfig from '../../eslint.config.js';

// Add Jest environment for test files and exclude build artifacts
export default [
  ...baseConfig,
  {
    // Exclude the rollup cache and dist directories from linting
    ignores: ['.rollup.cache/**', 'dist/**'],
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.js', '**/*.test.ts', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      }
    }
  }
];
