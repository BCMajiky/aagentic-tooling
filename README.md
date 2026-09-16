# aagentic-tooling

Developer tooling for the Agoric L1, built to compound: every later tool is one
workspace package plus one `aat` subcommand.

**Status: Stage 0, day 1.** The monorepo, toolchain and CI exist. The CLI shell
lands on day 2; the two shared formats on days 3 and 4.

## No telemetry

These tools collect nothing, send nothing, and phone home to nothing. There is
no analytics, no crash reporting and no usage counter, and there is no flag to
turn one on because there is nothing to turn off.

## Requirements

- Node `^22.11 || ^24.14` (`.nvmrc` pins 22 as primary)
- corepack, which provisions yarn 4.17.1 from the `packageManager` field

## Quick start

```sh
corepack enable
yarn install
yarn ci        # lint, typecheck, test
```

## Layout

```
packages/cli/       the aat umbrella CLI: subcommand registry, config, output, errors
packages/core/      shared helpers: config, output shapes, errors and hints
packages/schemas/   the shared formats: JSON Schema, TS types, validators, fixtures
docs/               specs and reference, published via GitHub Pages when public
examples/           minimal contracts used by tests, snippets and the SES smoke job
```

## Conventions

- ESM everywhere. TypeScript, built with `tsc` to `dist/`.
- Tests run under `@endo/ses-ava`, so every test runs under SES lockdown.
  `@endo/init` appears only in CLI entrypoints and test setup.
- Ambient authority stays in CLI entrypoints; modules take their capabilities as
  arguments.
- Every command supports `--json`. The shape is the same for every subcommand:
  `{ ok, code, findings?, data?, hint? }`.
- Exit codes: `0` ok, `1` findings, `2` usage error, `3` environment error.
- Conventional commits, one concern per commit.

Dependency versions are pinned exactly and explained in [docs/PINS.md](docs/PINS.md).

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
