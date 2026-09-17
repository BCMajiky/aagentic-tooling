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
      // examples/ holds @agoric API-exact copies of upstream contracts. They
      // are checked by the SES smoke job, not by our house lint rules:
      // linting them here would invite "improving" them, which the brief
      // explicitly forbids.
      'examples/**',
      // The snippet corpus is API-exact upstream code, checked by its own
      // corpus test, and its tests are plain JavaScript run through the
      // ts-blank-space loader, outside any tsconfig project.
      'packages/skills/snippets/**',
      // docs/notes/ holds records of runs, including code exactly as it was
      // run in workspaces outside this tree. Records are not source.
      'docs/notes/**',
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

      // `continue` is how a token loop stays flat. The alternative is nesting
      // the rest of each iteration in an else, which reads worse in exactly the
      // place — argument and config parsing — where clarity matters most.
      'no-continue': 'off',

      // TypeScript already reports both of these, and reports them better: the
      // base rules do not know about `node:` globals or about type-position
      // parameter names. Keep the typed versions only.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
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

  {
    // Entrypoint scripts. These are the places ambient authority is allowed,
    // and the SES smoke job bundles each example in turn on purpose: a bundle
    // is over a megabyte, and doing them concurrently spikes memory and
    // interleaves the output that a failing job is read for.
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-await-in-loop': 'off',
      'no-console': 'off',
    },
  },
);
