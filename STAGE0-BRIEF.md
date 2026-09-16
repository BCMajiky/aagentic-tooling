# Stage 0 brief for Claude Code

Working folder: `~/Desktop/Agoric-L1/aagentic-tooling/`. Plan of record: `docs/context/Agoric_L1_Opps.md` §1, as amended by `docs/context/claude_plan-amendments.md`. This brief resolves the decisions the plan left open and carries the constraints that came out of the Servandum devnet work. Where it conflicts with the plan, this brief wins.

Date: 16 September 2026.

## Decisions, resolved

**D1. SDK pin: `agoric-upgrade-23`.**
Install Agoric packages from npm at the `agoric-upgrade-23` dist-tag: `@agoric/zoe 0.28.0-u23.1`, `@agoric/orchestration 0.3.0-u23.1`, and the same tag for `@agoric/ertp`, `@agoric/time`, `@agoric/vat-data`, `@agoric/internal`, `@agoric/deploy-script-support`. Pin exact versions in `package.json`, no carets, because the whole point of the SES smoke job is to run under the SDK a contract author will actually install. Upgrade-23 is the current mainnet line (23a is the live tag, cosmos-sdk v0.53, cometbft v0.38). There is also a published `dev` build matching the master clone (`0.26.3-dev-a2a3de9.0`), which is convenient for reading source but is not what any network runs; do not pin to it. Record the pin in `docs/PINS.md` alongside the upstream commit table.

Add a second shallow clone `~/Desktop/Agoric-L1/upstream/agoric-sdk-u23` at tag `agoric-upgrade-23a` so that source read for format B and for Release 1 snippets matches the installed packages. Keep the master clone for `AGENTS.md`, `.agents/skills/` and `portfolio-contract`, which are the reasons it was pulled. Clones are made from a native terminal, not from Claude Code, because the mount cannot run git write operations against that folder.

Endo pins follow the SDK at u23 rather than the amendments list, which was taken from master: read `@endo/*` versions out of the installed `@agoric/zoe@0.28.0-u23.1` dependency tree on day 1 and pin to those. `@endo/ses-ava` and `@endo/bundle-source` are dev-only and can sit at their current latest (1.4.2 and 4.3.2) unless resolution conflicts.

**D2. Format B accepts unguarded facets. Subjects are Offer Up and send-anywhere.**
Offer Up's public facet is `Far()` with no `M.interface` guard. That is not a reason to drop it: it is the contract every tutorial starts from, Release 1's definition of done is "produce a working Offer Up variant", and a generator (Release 6) that fails on `Far()` facets fails on most contracts in the wild. So the v0 schema carries a per-facet `guard` field with values `interface` (methods projected from `M.interface`, with param and return patterns) and `none` (method names only, taken from the object literal, patterns absent). The spec names the Far case and says what is lost. Offer Up's manifest therefore has `facets.public.guard: "none"` and a fully populated `invitations` section from its `proposalShape`.

The second subject moves from dapp-orchestration-basics `orca` to the SDK's own `send-anywhere` (contract plus flows, at u23a). Orca pins a patched dev build of orchestration from upgrade-17 and has not moved in over a year; send-anywhere moves with the SDK and uses `zone.exo` with `M.interface`, so between the two subjects both `guard` values are exercised. Orca stays out of Stage 0 entirely.

**D3. npm scope `@dcfoundation`, with a five-minute check on day 1.**
No public packages exist under `@dcfoundation`, `@dcf` or `@aagentic`. Whether the `dcfoundation` org is registered cannot be seen from outside. Day 1, first thing, from a logged-in terminal: `npm org ls dcfoundation`. If Bob controls it, use it. If it is taken by someone else, fall back to `@aagentic` (free as of today) and update this brief. Nothing publishes in Stage 0 in either case; every package carries `"private": true` until the changesets release workflow is switched on at Release 1 v0.1. Unscoped `aat` is free on npm and is reserved by the CLI's `bin` name, not by publishing it.

**D4. GitHub remote from day 1, private until Stage 0 is done.**
"Local" means the work happens on the Mac; it does not mean no remote. CI is one of the five compounding properties and the only honest test of "CI is green" is a real Actions run. Create `DCFoundation/aagentic-tooling` as a private repo on day 1 and push at the end of each day. Flip to public when the §1.8 definition of done is met; that is also when GitHub Pages is enabled (Pages needs a public repo on the current plan, so the docs workflow is written on day 5 and verified with a local `yarn docs:build`, with the deploy job gated on `github.event.repository.private == false`). Repo settings on creation: default branch `main`, squash merges only, branch protection requiring CI on `main`.

**D5. Apache-2.0.**
Snippets, fixtures and example contracts derive from Apache-2.0 sources (agoric-sdk, dapp-offer-up). Same licence means attribution is a NOTICE file rather than a per-file relicensing question, and it matches what an upstream contribution back to Agoric will need. `LICENSE` at root, `NOTICE` listing the upstream repos and commits, SPDX header in every source file.

**D6. Node 22 primary, 24 in the test matrix. Yarn 4.17.1 via corepack.**
The SDK's engines field at u23 is `^22.11 || ^24.14` and its CI runs two Node versions. `.nvmrc` says `22`; `engines` in the root `package.json` mirrors the SDK's range; the CI test job runs on 22 and 24, everything else on 22 only. `corepack enable` is the first step in every CI job and in `CONTRIBUTING.md`, ordered before `setup-node` (the ordering bit the Servandum CI).

## What Stage 0 builds

Unchanged from the plan §1.2 to §1.6: yarn workspaces monorepo, `packages/cli` (`aat`), `packages/core`, `packages/schemas`, `docs/`, `examples/`, CI with lint, types, tests and the SES smoke job, `AGENTS.md` at root.

Additions and clarifications:

- `examples/` holds two contracts at Stage 0: `offer-up` (copied from dapp-offer-up at 4ea27c5, with the source noted, then checked against zoe 0.28.0-u23.1 and adjusted if the API moved) and `send-anywhere` (contract and flows from agoric-sdk at agoric-upgrade-23a). These are the SES smoke subjects and the format B subjects. They stay `@agoric` API-exact; do not "improve" them.
- `packages/core` config keys at Stage 0: `network` (one of `local`, `devnet`, `emerynet`, `mainnet`), `rpc`, `api`, `vstorage`, `chainId`, `walletAddress`, `output.json`. Ship a `networks.json` with the four networks' endpoints and chain ids; devnet and emerynet entries carry the pay denom (`ibc/toyusdc` on devnet) because every later tool needs it and it differs per network.
- The error type's `hint` strings live in `packages/core/src/hints.ts` as a single exported map keyed by error code. Release 1's error catalogue imports the same map. That is the mechanism behind "hints are the same text the skill pack uses"; build it now so nothing has to be retrofitted.
- Exit codes: 0 ok, 1 findings, 2 usage error, 3 environment error. `--json` output is `{ ok, code, findings?, data?, hint? }` and is the same shape for every subcommand.
- No telemetry. State it in the README in one sentence.

## Format A notes for day 3

Event kinds in the plan table stand. Take span attribute names from the exos in `agoric-sdk-u23/packages/orchestration/src/exos/` (chain-hub, orchestrator, local and cosmos orchestration accounts, ica-account-kit, icq-connection-kit, ibc-packet) so that when VowScope instruments them the names already line up. The five fixtures are timer wait, ICA send with ack, vow rejection, flow restart, multi-hop. The multi-hop fixture should be a send-anywhere transfer so it is checkable against a real contract later. Versioning rule in the spec: additive is minor, breaking is major and the old schema file stays in the tree.

## Format B notes for days 4 and 5

Schema sections as in the plan §1.5, plus `facets.<name>.guard` from D2. Pattern serialisation covers the `@endo/patterns` subset actually seen in the two subjects and in `agoric-sdk-u23/packages/zoe/src/typeGuards.js`; list the supported vocabulary in the spec and reject anything outside it rather than guessing. Reviewer test for the Offer Up manifest: someone who has not read the contract describes what it does from the manifest alone and gets it right.

The design note to Kris goes out on day 5 and covers: the OpenTelemetry borrowing for A, the `guard: none` decision for B, the pattern subset, and one question, which is whether the orchestration exo interface guards in `exo-interfaces.ts` are stable enough to treat as a source of truth for manifests.

## Day plan

| Day | Work | Done when |
| :-- | :-- | :-- |
| 1 | `npm org ls dcfoundation`; create the private remote; `git init`, licence, NOTICE, workspace root, `.nvmrc`, corepack, pins from D1, CI skeleton with corepack before setup-node, branch protection. | `yarn install && yarn test` passes on the empty tree in Actions on Node 22 and 24. |
| 2 | CLI shell: subcommand registry, config layering with `networks.json`, `--json`, error type with hint map, exit codes, `--version`, `doctor --help` stub, `schemas list`. | `aat` installs globally and runs; config precedence and exit codes have unit tests. |
| 3 | Format A: schema, TS type, validator, five fixtures, spec page. | Fixtures validate; a broken fixture fails; `aat schemas list` shows `trace-event v0`. |
| 4 | Format B: schema with `guard`, TS type, validator, spec page; `examples/offer-up` checked against u23 and bundled under SES; hand-author the Offer Up manifest. | Manifest validates; SES smoke job green for offer-up. |
| 5 | `examples/send-anywhere` from u23a, bundled under SES; hand-author its manifest; docs site scaffold with gated Pages deploy; `AGENTS.md` and the divergence test; design note to Kris; push; flip repo to public if §1.8 is met. | Both manifests validated by someone other than the author; docs build locally; note sent; CI green. |

## Rules that carry over from the devnet work

These are Stage 0 relevant. The full list is in `docs/context/claude_agoric-devnet-sharp-edges.md`.

- Every test runs under `@endo/ses-ava`. No `@endo/init` plus plain ava; that passes under conditions the chain never provides.
- `harden()` everything the fixtures and validators return.
- No `Date.now()`, `Math.random()`, network or filesystem in anything under `examples/`. The SES smoke job exists to catch this, so let it.
- Regenerate `yarn.lock` after any package rename; legacy lockfile errors on CI are almost always this.
- Anything that will later touch a chain (`aat doctor`, Release 2) uses explicit gas of 100000000 for bundle installs and verifies the bundle id on chain before trusting a success response. Not built in Stage 0, but the `networks.json` and hint map should already have entries for it.

## Not in Stage 0

Doctor implementation (Release 2). The manifest generator (Release 6). Orca or anything from dapp-orchestration-basics. Publishing to npm. Skill pack content. Any chain interaction beyond reading `networks.json`.

## Open until someone answers

- Who validates the two manifests on day 5. Needs to be a person other than whoever authored them.
- Whether Kris's reply to the design note has to arrive before Release 6; the plan says yes, nothing before that depends on it.
