# aagentic-tooling

Developer tooling for the Agoric L1, built to compound: every later tool is one
workspace package plus one `aat` subcommand.

**Status: Stage 0 complete bar the public flip.** Monorepo, toolchain, CI, the
`aat` CLI shell, both shared formats with hand-authored manifests for two real
contracts, and a SES smoke job that bundles those contracts and runs them under
`lockdown()`.

Two things are outstanding and neither is code: the internal planning material
in `docs/context/` has to leave the git history, and the repository has to move
to the DCFoundation org. See [docs/BEFORE-PUBLIC.md](docs/BEFORE-PUBLIC.md).

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

## Using `aat`

```sh
yarn build
node packages/cli/dist/src/main.js --help
```

To put it on your PATH while developing, `cd packages/cli && npm link`; `npm
unlink -g @dcfoundation/aat-cli` removes it again. Nothing is published to npm
during Stage 0.

```
aat --version
aat --help
aat schemas list                     # the shared formats this build knows
aat config show                      # resolved config, and where each value came from
aat config keys                      # what you can set
aat doctor --help                    # stub; the checks arrive in Release 2
```

```sh
yarn smoke                           # bundle examples/ and run them under SES
yarn docs:build                      # build the docs site into docs/_site
```

Every subcommand takes `--json`:

```console
$ aat schemas list
trace-event        v0  Workflow trace events: an OpenTelemetry span with an Agoric attribute set.
contract-manifest  v0  What a contract accepts and publishes, projected from its guards and proposal shapes.

$ aat bogus --json; echo "exit $?"
{"ok":false,"code":2,"findings":[{"code":"USAGE_UNKNOWN_SUBCOMMAND","message":"unknown subcommand 'bogus'; known subcommands are config, doctor, schemas"}],"hint":"Run `aat --help` for the list of subcommands."}
exit 2
```

One line of JSON per invocation, so output pipes into `jq` and appends to a log.

### Configuration

Layered, lowest precedence first:

| Layer | Where |
|---|---|
| defaults | built in, plus the endpoints of the selected network |
| user file | `~/.aat/config.json` |
| project file | `./.aat.json`, or the path given to `--config` |
| environment | `AAT_NETWORK`, `AAT_RPC`, `AAT_API`, `AAT_VSTORAGE`, `AAT_CHAIN_ID`, `AAT_WALLET_ADDRESS`, `AAT_JSON` |
| flags | `--network`, `--rpc`, `--api`, `--vstorage`, `--chain-id`, `--wallet-address`, `--json` |

`aat config show` prints the resolved value of every key next to the layer it
came from, which is the quickest answer to "why is it pointing at that".

Selecting a network seeds `rpc`, `api`, `vstorage` and `chainId` before any
explicit endpoint is applied. So `--network mainnet` overrides an `rpc` set in a
file, while `--network mainnet --rpc http://0.0.0.0:26657` keeps the explicit
one.

An unknown key in a config file is an error, not a warning. A silently ignored
`rpcAddr` is how someone loses an afternoon.

> The `chainId` for `devnet` and `emerynet` in `networks.json` is last-known,
> not durable: those chains are redeployed under new ids. Each entry carries its
> `networkConfig` URL, and anything that actually talks to a chain must fetch
> and verify rather than trusting the file.

## Layout

```
packages/cli/       the aat umbrella CLI: subcommand registry, config, output, errors
packages/core/      shared helpers: config, output shapes, errors and hints
packages/schemas/   the shared formats: JSON Schema, TS types, validators, fixtures
docs/               specs and reference, published via GitHub Pages when public
examples/           minimal contracts used by tests, snippets and the SES smoke job
scripts/            entrypoints: the SES smoke job, the docs build, AGENTS.md
```

## Documentation

| | |
|---|---|
| [Format A: workflow trace events](docs/formats/trace-event.v0.md) | what happened, in what order, on which chain |
| [Format B: contract interface manifests](docs/formats/contract-manifest.v0.md) | what a contract accepts and publishes |
| [AGENTS.md](AGENTS.md) | instructions for people and coding agents |
| [docs/PINS.md](docs/PINS.md) | every pin, and why |
| [The format design note](docs/notes/format-design-note-2026-09-16.md) | the case for both formats, for a reader outside this repo |

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
