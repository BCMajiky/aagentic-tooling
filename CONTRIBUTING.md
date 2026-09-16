# Contributing

## Setting up

Order matters here. `corepack enable` comes **first**, before anything that
needs `yarn` on the PATH — including `actions/setup-node`'s `cache: yarn`, which
shells out to yarn to find the cache folder. Getting this backwards is what
broke the Servandum CI.

```sh
corepack enable          # provisions yarn 4.17.1 from package.json
nvm use                  # reads .nvmrc: Node 22
yarn install
yarn ci                  # lint, typecheck, test
```

Node `^22.11 || ^24.14`. CI runs the tests on both 22 and 24; everything else
runs on 22 only.

## The checks

| Command | What it does |
|---|---|
| `yarn lint` | eslint, including the `@endo/eslint-plugin` Hardened JS pass |
| `yarn typecheck` | `tsc --build` across the workspace project references |
| `yarn test` | builds, then runs each package's ava suite under `@endo/ses-ava` |
| `yarn ci` | all three, in that order |

`yarn test` builds first on purpose: ava runs the compiled output through
`@ava/typescript`, so a stale `dist/` would test the wrong thing.

## Rules that are not negotiable

These come from STAGE0-BRIEF.md and from the devnet work that preceded it.

- **Tests run under `@endo/ses-ava`.** Not `@endo/init` plus plain ava — that
  passes under conditions the chain never provides. Each package has a
  `test/prepare-test-env-ava.ts` that wraps ava, and an `ava.require` entry for
  `@endo/init/debug.js`. New test files import `test` from that module.
- **`harden()` everything** a fixture or validator returns.
- **Ambient authority stays in entrypoints.** A module that needs the clock, the
  network or the filesystem takes it as an argument. `packages/cli/src/main.ts`
  is the only file that reads `process`.
- **Nothing under `examples/`** may use `Date.now()`, `Math.random()`, the
  network or the filesystem. The SES smoke job exists to catch this; let it.
- **No telemetry.** Ever, anywhere.
- **Do not modify `../upstream/`.** Those clones are pinned reference material.
  Read them; re-clone to update.

## Dependencies

Pin exactly — no carets. Agoric packages come from the `agoric-upgrade-23`
dist-tag; Endo packages are held to the versions in the u23 dependency tree by
`resolutions` in the workspace root. Both tables, and the reasoning, are in
[docs/PINS.md](docs/PINS.md).

Adding an `@endo/*` or `@agoric/*` dependency means adding it to that table too.
If tests start failing with `TypeError: Cannot redefine property:
sliceToImmutable`, you have two copies of `ses`; see the same file.

Regenerate `yarn.lock` after any package rename. Legacy lockfile errors in CI
are almost always this.

## Commits

Conventional commits, one concern per commit. `feat:`, `fix:`, `docs:`,
`chore:`, `ci:`, `test:`, `refactor:`.

## Licence and attribution

Apache-2.0. Every source file carries an SPDX header:

```js
// SPDX-License-Identifier: Apache-2.0
```

Code derived from an upstream repository gets a comment naming the source file
and the pinned commit, and the repository is listed in [NOTICE](NOTICE).
