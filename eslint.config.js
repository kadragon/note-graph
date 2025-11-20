import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Shared rules for both backend and frontend
const sharedRules = {
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-return': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/require-await': 'warn',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-misused-promises': 'warn',
  '@typescript-eslint/unbound-method': 'warn',
  '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
  '@typescript-eslint/prefer-promise-reject-errors': 'warn',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
};

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'public/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Backend configuration (src/)
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.backend.json',
      },
    },
    rules: sharedRules,
  },

  // Frontend configuration (frontend/src/)
  {
    files: ['frontend/src/**/*.ts', 'frontend/src/**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.es2022,
        ...globals.browser,
      },
      parserOptions: {
        project: './tsconfig.app.json',
      },
    },
    rules: sharedRules,
  }
);
