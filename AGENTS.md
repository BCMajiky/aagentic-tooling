# Agent instructions for aagentic-tooling

Per <https://agents.md/>. This file is for anything working in this repository:
a person, or a coding agent.

Sections marked `<!-- BEGIN GENERATED -->` are rendered from the code by
`yarn agents:write`, and `yarn agents:check` fails when they drift. Do not edit
them by hand — change the code and regenerate. At Release 1 the skill pack
renders from the same function, which is what makes "the hints are the same text
the skill pack uses" true by construction.

## Setup

Order matters. `corepack enable` comes **first**, before anything needing
`yarn` on the PATH.

```sh
corepack enable
nvm use            # reads .nvmrc: Node 22
yarn install
yarn ci            # lint, typecheck, test
yarn smoke         # bundle examples/ and run them under SES
```

Node `^22.11 || ^24.14`. CI requires Node 22; Node 24 runs `continue-on-error`
because the pinned SDK declares `^20.9 || ^22.11`.

## Rules that are not negotiable

These come from `STAGE0-BRIEF.md` and from the devnet work behind it. An agent
that breaks one of these has made the repository worse even if the tests pass.

1. **Tests run under `@endo/ses-ava`.** Not `@endo/init` plus plain ava, which
   passes under conditions the chain never provides. Import `test` from the
   package's `test/prepare-test-env-ava.ts`.
2. **`harden()` everything** a fixture or validator returns.
3. **Ambient authority stays in entrypoints.** A module that needs the clock,
   the network or the filesystem takes it as an argument.
   `packages/cli/src/main.ts` and `scripts/*.mjs` are the only files that read
   `process`. `@endo/init` appears only in those and in test setup.
4. **Nothing under `examples/`** may use `Date.now()`, `Math.random()`, the
   network or the filesystem. `yarn smoke` exists to catch that.
5. **Do not "improve" `examples/`.** They are `@agoric` API-exact copies of
   upstream contracts, and they are format B and SES smoke subjects. Change one
   only when it will not otherwise run against the pinned SDK, and say why in
   the file header.
6. **Do not modify `../upstream/`.** Those clones are pinned reference material.
   Read them; re-clone to update.
7. **No telemetry.** Ever, anywhere.
8. **Pin exactly.** No carets. The Endo tree is held to the u23 versions by
   `resolutions`; see `docs/PINS.md`, including the duplicate-`ses` trap.

## Where things are

```
packages/cli/       the aat CLI: registry, flag parsing, config layering, output
packages/core/      exit codes, the error type, the hint map, networks, config
packages/schemas/   the two shared formats: schema, types, validator, fixtures
examples/           API-exact upstream contracts; SES smoke and format subjects
scripts/            entrypoints: the SES smoke job, the AGENTS.md generator
docs/formats/       the format specs
docs/context/       internal planning material; see docs/BEFORE-PUBLIC.md
```

## Adding a tool

The compounding promise from plan §1.1 is that a new tool is one workspace
package plus one subcommand, and nothing else:

1. `packages/<name>/` with the same `package.json` and `tsconfig.json` shape as
   an existing package.
2. Export a `Subcommand` — `{ name, summary, flags?, help?, run }`.
3. Add it to the array in `packages/cli/src/run.ts`.
4. Add a project reference in `packages/cli/tsconfig.json` and the root
   `tsconfig.json`.

A subcommand receives `CommandContext`: parsed args, resolved config,
provenance, and a `print`. Anything else it needs is a capability passed in.

## Subcommands

<!-- BEGIN GENERATED: subcommands -->
| Subcommand | What it does |
|---|---|
| `aat config` | Show the resolved configuration and where each value came from. |
| `aat doctor` | Check that this machine can build and deploy Agoric contracts. (Release 2) |
| `aat schemas` | List the shared formats this build knows. |
<!-- END GENERATED: subcommands -->

## Output contract

Every subcommand supports `--json` and emits one line of this envelope:

```json
{ "ok": true, "code": 0, "data": {} }
```

`findings` and `hint` appear only when there is something to say. Command
output goes inside `data`; no subcommand adds a top-level key.

<!-- BEGIN GENERATED: exit-codes -->
| Code | Name | Meaning |
|---|---|---|
| 0 | `OK` | Ran, nothing to report. |
| 1 | `FINDINGS` | Ran correctly and has findings. Not an error. |
| 2 | `USAGE` | The invocation was wrong: bad flag, missing argument. |
| 3 | `ENVIRONMENT` | The world is wrong: unreachable endpoint, missing binary, bad config. |
<!-- END GENERATED: exit-codes -->

Findings are not errors. A command that returns findings ran correctly.

## Errors and hints

Throw `AatError` with a code. The code carries the exit code and the hint, so
no call site has to remember either. Adding a code means adding a hint in
`packages/core/src/hints.ts`; the type checker enforces it.

A hint says **what to do**, not what went wrong, and names the exact command,
flag or file. Where a wrong answer looks like success, it says so.

<!-- BEGIN GENERATED: error-hints -->
| Code | Exit | What to do |
|---|---|---|
| `USAGE_UNKNOWN_SUBCOMMAND` | 2 | Run `aat --help` for the list of subcommands. |
| `USAGE_NO_SUBCOMMAND` | 2 | Run `aat --help` for the list of subcommands, or `aat <subcommand> --help` for one of them. |
| `USAGE_UNKNOWN_FLAG` | 2 | Run `aat <subcommand> --help` for the flags that subcommand accepts. Every subcommand also accepts `--json`. |
| `USAGE_FLAG_NEEDS_VALUE` | 2 | Supply the value as `--flag value` or `--flag=value`. |
| `USAGE_UNEXPECTED_ARGUMENT` | 2 | Run `aat <subcommand> --help` to see what that subcommand expects. |
| `CONFIG_UNREADABLE` | 3 | Check the file exists and is readable. Configuration is optional: delete the file and `aat` falls back to the defaults for the selected network. |
| `CONFIG_MALFORMED` | 3 | The file must be a JSON object. Validate it with `node --eval "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`. |
| `CONFIG_UNKNOWN_NETWORK` | 3 | Use one of `local`, `devnet`, `emerynet` or `mainnet`, or set `rpc`, `api` and `chainId` explicitly to point at something else. |
| `CONFIG_UNKNOWN_KEY` | 3 | Run `aat config keys` for the keys this version understands. An unknown key is usually a typo or a key from a newer version. |
| `CONFIG_BAD_VALUE` | 3 | Check the value against the type the key expects. |
| `ENV_RPC_UNREACHABLE` | 3 | Check the endpoint with `curl <rpc>/status`. For a local chain, confirm it is running and that you are on the right port; the default is 26657. |
| `ENV_BINARY_MISSING` | 3 | Install the missing binary and make sure it is on PATH. `agd` ships in the agoric-sdk Docker image if you do not want to build it. |
| `ENV_NODE_VERSION` | 3 | Use Node ^22.11 or ^24.14. `nvm use` reads the .nvmrc in this repository. |
| `CHAIN_BUNDLE_INSTALL_UNDERGASSED` | 3 | Reinstall with explicit `--gas 100000000`. `--gas auto` and lower fixed values return a success code and install nothing, so a transaction hash is not proof that the bundle landed. |
| `CHAIN_BUNDLE_NOT_FOUND` | 3 | Query the chain for the bundle id before going further. A successful install transaction is not proof; the install silently fails when under-gassed. |
| `CHAIN_PAYLOAD_TOO_LARGE` | 3 | Compress the bundle before installing. Public RPC rejects bodies over about 1MB with HTTP 413; a contract still over that compressed needs the multi-bundle install pattern. |
| `CHAIN_ACCOUNT_SEQUENCE_MISMATCH` | 3 | The previous transaction is not in a block yet. Wait for the next block and retry. |
| `CHAIN_DENOM_UNKNOWN` | 3 | List what the chain knows with `agd query vstorage data published.agoricNames.vbankAsset`. The pay denom differs per network — devnet is `ibc/toyusdc` — so keep it a contract term rather than hardcoding it. |
| `INTERNAL` | 3 | This is a bug in aat. Please report it with the command you ran and the full output. |
<!-- END GENERATED: error-hints -->

## Configuration

Layered, lowest precedence first: defaults, `~/.aat/config.json`, `./.aat.json`
(or `--config`), environment (`AAT_*`), flags. The selected network seeds
`rpc`, `api`, `vstorage` and `chainId` before explicit endpoint values apply.
`aat config show` prints each value next to the layer it came from.

An unknown config key is an error, not a warning.

<!-- BEGIN GENERATED: networks -->
| Network | Chain id | Chain id rotates? |
|---|---|---|
| `local` | `agoriclocal` | no |
| `devnet` | `agoricdev-25` | yes, verify against networkConfig |
| `emerynet` | `agoric-emerynet-8` | yes, verify against networkConfig |
| `mainnet` | `agoric-3` | no |
<!-- END GENERATED: networks -->

## Shared formats

<!-- BEGIN GENERATED: formats -->
| Format | Version | What it describes |
|---|---|---|
| `trace-event` | v0 | Workflow trace events: an OpenTelemetry span with an Agoric attribute set. |
| `contract-manifest` | v0 | What a contract accepts and publishes, projected from its guards and proposal shapes. |
<!-- END GENERATED: formats -->

Both are versioned the same way: **additive is minor; breaking is major, and
the old schema file stays in the tree**. Each has a hand-written spec in
`docs/formats/` and fixtures in `packages/schemas/fixtures/`, where every
invalid fixture is paired with the code it must report.

## Working with the Agoric SDK

When unsure about an Agoric or Endo API, **grep `../upstream/agoric-sdk-u23`
before writing code**. That clone is the tag the installed packages come from.
The `agoric-sdk` master clone is newer than anything any network runs; use it
only for `AGENTS.md`, `.agents/skills/` and `portfolio-contract`.

Two traps worth knowing, both found the hard way:

- An import that resolves in the docs may not exist at u23.
  `@agoric/zoe/exported.js` is gone, and it fails at bundle time, not at
  type-check time. `yarn smoke` is what catches this class of thing.
- Upstream is not internally consistent. Port and channel identifiers are
  spelled three ways depending on layer, and exo facet keys do not reliably
  match their `M.interface` labels. Check, do not assume.

## Commits

Conventional commits, one concern per commit. Say *why*, not what: the diff
already says what. Every source file carries
`// SPDX-License-Identifier: Apache-2.0`, and code derived from upstream names
its source file and pinned commit.
