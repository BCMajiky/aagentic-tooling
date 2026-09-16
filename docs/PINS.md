# Pins

Everything this repository is pinned to, and why. Pins are exact: no carets in
`package.json`, and the Endo tree is held in place by `resolutions` in the
workspace root.

Last verified: 2026-09-16 (day 1 of Stage 0).

## Why exact

The SES smoke job (day 4) has to run under the SDK a contract author will
actually install. A caret that floats to a newer Endo minor silently changes the
lockdown behaviour the job is supposed to be testing — and on day 1 it already
did: see "The duplicate-SES trap" below.

## Upstream clones

Read-only shallow clones under `../upstream/`. See `../upstream/UPSTREAM.md`.

| Repo | Folder | Commit | Date | Ref |
|---|---|---|---|---|
| Agoric/agoric-sdk | `agoric-sdk` | a2a3de9 | 2026-09-11 | master |
| Agoric/agoric-sdk | `agoric-sdk-u23` | cc25a29 | 2026-07-27 | tag `agoric-upgrade-23a` |
| Agoric/dapp-offer-up | `dapp-offer-up` | 4ea27c5 | 2025-04-05 | main |
| Agoric/dapp-orchestration-basics | `dapp-orchestration-basics` | ebed14f | 2025-03-01 | main |
| Agoric/documentation | `documentation` | d89bd22 | 2026-04-28 | main |

`agoric-sdk-u23` is the clone that matters for anything we ship: it matches the
installed `@agoric/*` packages. The `master` clone is kept only for `AGENTS.md`,
`.agents/skills/` and `portfolio-contract`.

`dapp-orchestration-basics` is out of Stage 0 (D2). It stays cloned because
nothing is gained by deleting it.

## Agoric SDK packages (D1)

Dist-tag `agoric-upgrade-23`, which is the current mainnet line. Verified
against npm on 2026-09-16; each version below is what the tag resolves to.

| Package | Version |
|---|---|
| `@agoric/zoe` | `0.28.0-u23.1` |
| `@agoric/orchestration` | `0.3.0-u23.1` |
| `@agoric/ertp` | `0.18.0-u23.1` |
| `@agoric/time` | `0.5.0-u23.0` |
| `@agoric/vat-data` | `0.7.0-u23.1` |
| `@agoric/internal` | `0.5.0-u23.1` |
| `@agoric/deploy-script-support` | `0.12.0-u23.1` |

None of these are installed yet. They arrive with `examples/offer-up` on day 4
and `examples/send-anywhere` on day 5. The versions are fixed here so that
nobody types `yarn add @agoric/zoe` and gets `latest` (`0.27.0`, an older line
despite the higher-looking number) or `dev`
(`0.26.3-dev-a2a3de9.0`, which matches the master clone but is not what any
network runs).

## Endo packages

D1 says to read the Endo versions out of the u23 dependency tree rather than
taking them from `latest`. The table below is extracted from
`upstream/agoric-sdk-u23/yarn.lock` at cc25a29, where every one of these
resolves to exactly one version.

These are enforced by `resolutions` in the workspace root, not just by
`dependencies`, because the constraint is on the whole tree.

| Package | Pinned |
|---|---|
| `ses` | `1.14.0` |
| `@endo/base64` | `1.0.12` |
| `@endo/bundle-source` | `4.1.2` |
| `@endo/cache-map` | `1.1.0` |
| `@endo/captp` | `4.4.8` |
| `@endo/check-bundle` | `1.0.17` |
| `@endo/cjs-module-analyzer` | `1.0.11` |
| `@endo/common` | `1.2.13` |
| `@endo/compartment-mapper` | `1.6.3` |
| `@endo/env-options` | `1.1.11` |
| `@endo/errors` | `1.2.13` |
| `@endo/evasive-transform` | `2.0.2` |
| `@endo/eventual-send` | `1.3.4` |
| `@endo/exo` | `1.5.12` |
| `@endo/far` | `1.1.14` |
| `@endo/immutable-arraybuffer` | `1.1.2` |
| `@endo/import-bundle` | `1.5.2` |
| `@endo/init` | `1.1.12` |
| `@endo/lockdown` | `1.0.18` |
| `@endo/marshal` | `1.8.0` |
| `@endo/module-source` | `1.3.3` |
| `@endo/nat` | `5.1.3` |
| `@endo/netstring` | `1.0.18` |
| `@endo/pass-style` | `1.6.3` |
| `@endo/path-compare` | `1.1.0` |
| `@endo/patterns` | `1.7.0` |
| `@endo/promise-kit` | `1.1.13` |
| `@endo/ses-ava` | `1.3.2` |
| `@endo/stream` | `1.2.13` |
| `@endo/stream-node` | `1.1.13` |
| `@endo/trampoline` | `1.0.5` |
| `@endo/where` | `1.0.11` |
| `@endo/zip` | `1.0.11` |

`@endo/eslint-plugin` is deliberately **not** in that table. It is a lint-time
tool that never loads under SES and has no `@endo` runtime dependencies, so it
tracks `latest` (`3.0.0`).

### Departure from the brief: ses-ava and bundle-source

STAGE0-BRIEF.md D1 says `@endo/ses-ava` and `@endo/bundle-source` are dev-only
and "can sit at their current latest (1.4.2 and 4.3.2) unless resolution
conflicts". They conflict, so they are pinned to the u23 tree versions
(`1.3.2` and `4.1.2`) instead:

- `@endo/ses-ava@1.4.2` requires `ses ^2.2.0` and `@endo/init ^1.1.13`. The u23
  tree is `ses 1.14.0` via `@endo/lockdown 1.0.18`. Two majors of `ses` in one
  process means two `lockdown()` implementations.
- `@endo/bundle-source@4.3.2` requires `@endo/compartment-mapper ^2.3.0` against
  the tree's `1.6.3`, and `@endo/init ^1.1.13`. It also would not be the
  bundler the SDK uses, which defeats the point of the SES smoke job.

### The duplicate-SES trap

Pinning only the top-level packages is not enough, and this is worth writing
down because it cost time on day 1 and will recur every time a package is added.

Pinning `@endo/init` to `1.1.12` and `ses` to `1.14.0` in `devDependencies`
still produced three copies of `ses` in `node_modules`:

```
node_modules/ses                          1.14.0   (our devDependency)
node_modules/@endo/ses-ava/node_modules/ses  1.15.0   (ses-ava's ^1.14.0 floated)
node_modules/@endo/lockdown/node_modules/ses 2.3.0   (init's ^1.0.18 floated to a
                                                      lockdown that wants ses 2)
```

Two of them ran their `@endo/immutable-arraybuffer` shim, and the second failed:

```
About to overwrite ArrayBuffer.prototype properties
  ["sliceToImmutable","immutable","transferToImmutable"]
TypeError: Cannot redefine property: sliceToImmutable
```

Every test failed, on Node 22 and Node 24 alike. The fix is `resolutions` over
the whole `@endo/*` tree, above. If a future install produces that error, the
first thing to check is:

```sh
find node_modules -type d -path '*node_modules/ses' \
  -exec sh -c 'echo -n "$1: "; node -p "require(\"$1/package.json\").version"' _ {} \;
```

More than one line means a pin is missing from `resolutions`.

## Toolchain (D6)

| Thing | Pinned | Note |
|---|---|---|
| Node (primary) | `22` | `.nvmrc`; CI `types` and `lint` jobs use it |
| Node (matrix) | `22`, `24` | CI `test` job only |
| `engines.node` | `^22.11 \|\| ^24.14` | per STAGE0-BRIEF.md D6 and CLAUDE.md |
| yarn | `4.17.1` | `packageManager`, provisioned by corepack; no committed release binary |
| TypeScript | `6.0.3` | agoric-sdk u23 is on `~6.0.1-rc`; `6.0.3` is that line, released |
| eslint | `10.10.0` | with `typescript-eslint 8.70.0` (peer range `<6.1.0` for TS) |
| ava | `6.4.1` | matches agoric-sdk u23 |
| `@types/node` | `22.19.21` | `22.20.x` is quarantined on npm as of 2026-09-16 |

### Departure from the brief: the engines justification

D6 says "the SDK's engines field at u23 is `^22.11 || ^24.14`". It is not. At
cc25a29 the agoric-sdk root `package.json` says:

```json
"engines": { "node": "^20.9 || ^22.11" }
```

Node 24 is not a version the u23 SDK claims to support. The brief's *decision*
is still what this repo implements — `engines` is `^22.11 || ^24.14` and the
test matrix runs 22 and 24 — because the brief wins on conflict and because a
tool that a developer installs globally should work on current Node. But the
stated reason for it is wrong, and the risk it was meant to rule out is real:
when `@agoric/*` packages are installed on day 4, the Node 24 leg of the matrix
is the one that may break first. The `resolutions` table above is what keeps
that honest, since it holds the SES line the SDK was tested against.

Verified on day 1: the full test suite passes under SES on Node 22.23.2 and
Node 24.19.0 locally.

## npm scope

`@dcfoundation`. The org is unregistered and free on npm; it will be claimed
later. Nothing publishes in Stage 0 — every package carries `"private": true`,
there is no npm login and no release workflow. The `changesets` release
workflow is switched on at Release 1 v0.1, and that is the first point at which
the scope has to actually exist.

Package names are scoped with an `aat-` prefix (`@dcfoundation/aat-cli`,
`@dcfoundation/aat-core`, `@dcfoundation/aat-schemas`) rather than claiming
bare `@dcfoundation/cli` and `@dcfoundation/core`, because the org is the
foundation's and will hold more than this repo.

Unscoped `aat` is free on npm and is reserved by the CLI's `bin` name, not by
publishing it.
