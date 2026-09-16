// SPDX-License-Identifier: Apache-2.0

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import endo from '@endo/eslint-plugin';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.yarn/**',
      // Pinned upstream clones live outside this tree, but guard anyway.
      '**/upstream/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // The Hardened JS pass required by plan §1.6. `@endo/eslint-plugin` is what
  // agoric-sdk uses. `flat/recommended` is the set for code that *runs under*
  // SES: no floating eventual sends, no `harden` misuse, import hygiene.
  //
  // Not `flat/ses`: that one is for code that *implements* SES, so it bans
  // `Object` and every method call through a property lookup. agoric-sdk does
  // not apply it to its own packages either.
  ...endo.configs['flat/recommended'],

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // This config file is not part of any package's tsconfig.
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Installed by `lockdown()` from @endo/init.
        harden: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // `aat` is a CLI; its entrypoint writes to stdout/stderr through the
      // powers object, and nothing else should be logging.
      'no-console': 'error',

      // TypeScript already reports both of these, and reports them better: the
      // base rules do not know about `node:` globals or about type-position
      // parameter names. Keep the typed versions only.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Test files may assert on things the type checker objects to.
    files: ['**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  {
    // Tooling config is plain ESM outside any package's tsconfig, and imports
    // plugins that ship no types. Lint it, but not with type information.
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
