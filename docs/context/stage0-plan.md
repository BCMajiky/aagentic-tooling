# Stage 0: Set up for compounding

Extracted from "Stage 0 and Release 1, Detailed Plan for Review", 14 September 2026. Section 1 only. Release 1 (the AI coding skill pack) follows Stage 0 and is not part of this brief.

**Target duration:** 1 week (5 working days). **Output:** an empty-but-real monorepo with a working CLI that does one trivial thing, two versioned format specifications, and CI that enforces conventions.

## 1.1 What "compounding" concretely requires

The stage exists to make five things true for every later release:

1. A new tool is a new workspace package plus a CLI subcommand, nothing more.
2. All tools read the same configuration and emit the same output shapes (human-readable and `--json`).
3. Tools exchange data through versioned schemas that live in one place.
4. CI runs the same checks on every package, including a Hardened JS lint pass, so we eat our own cooking.
5. Documentation and skills are generated from the same source tree, so they cannot drift.

## 1.2 Repository layout

```
DCFoundation/aagentic-tooling/
  package.json            # yarn workspaces root; npm scope @dcfoundation
  packages/
    cli/                  # the umbrella CLI: subcommand loader, config, output, errors
    core/                 # shared helpers: config loading, RPC/vstorage client wrappers, logging
    schemas/              # the shared formats (JSON Schema + TS types + fixtures)
    skills/               # Release 1: skill pack sources
  docs/                   # generated + hand-written; published via GitHub Pages
  examples/               # minimal contracts used by tests, snippets and evals
  .github/workflows/
  AGENTS.md               # repo-level agent instructions (also a skill-pack artifact)
  CONTRIBUTING.md, LICENSE, SECURITY.md
```

Later releases add `packages/preflight`, `packages/probe`, `packages/vstorage`, `packages/trace` (VowScope), `packages/offer-lab`. Each registers a subcommand with `packages/cli`.

## 1.3 CLI shell

| Item | Detail |
|---|---|
| Binary | One executable (`aat`, alias `aagentic-tooling`), one entry point, subcommand plugin registry. |
| Subcommands at end of Stage 0 | `aat --version`, `aat doctor --help` (stub), `aat schemas list` (prints the registered formats and versions). Doctor itself is Release 2. |
| Config | Layered: defaults → `~/.aat/config.json` → `./.aat.json` → env vars → flags. Holds chain endpoints (RPC, API, vstorage), network name, wallet address, output preferences. |
| Output | Every command supports `--json` (machine-readable, stable) and defaults to human-readable. Exit codes are meaningful (0 ok, 1 findings, 2 usage error, 3 environment error). |
| Errors | One error type with a code, a message, and a "what to do" hint. Hints are the same text the skill pack uses, so humans and models get consistent guidance. |
| Telemetry | None. State this explicitly in the README; it is a trust signal for the audience. |

## 1.4 Shared format A: Workflow trace events

**Purpose:** a standard record of "what happened, in what order, on which chain," consumed by VowScope (Release 7), Studio, Sentinel and Event Relay.

**Design choice to confirm:** borrow the structure of OpenTelemetry spans (trace id, span id, parent span id, start/end, attributes, status) rather than inventing a shape. Developers already understand it, existing viewers can render it in a pinch, and it maps naturally onto the causal chain of an orchestration flow (a flow is a trace; each vow, timer wait, ICA call and IBC acknowledgement is a span).

**Agoric-specific attributes:**

| Attribute | Meaning |
|---|---|
| `agoric.block.height` | Block in which the event was observed or emitted. |
| `agoric.chain.id` | Chain the span acts on (Agoric itself or a remote chain). |
| `agoric.contract.instance` | Board id or instance handle of the emitting contract. |
| `agoric.flow.id` | Async-flow instance identity, so restarts and upgrades stitch together. |
| `agoric.event.kind` | Enumerated: `timer.set`, `timer.fired`, `vow.pending`, `vow.resolved`, `vow.rejected`, `ica.send`, `ica.ack`, `icq.query`, `icq.result`, `ibc.transfer`, `ibc.ack`, `ibc.timeout`, `offer.received`, `offer.exited`, `flow.restarted`, plus `custom`. |
| `agoric.retry.attempt` | For retried operations. |

**Deliverables:** JSON Schema (`trace-event.v0.schema.json`), TypeScript type, a validator function in `packages/schemas`, five hand-written fixture files covering a timer wait, an ICA call with ack, a rejection, a restart, and a multi-hop flow. A one-page spec explaining versioning rules (additive changes bump minor, breaking changes bump major and keep the old schema).

**Not in scope:** how contracts emit these events (VowScope's job) or how they are transported off-chain (vstorage, Event Relay).

## 1.5 Shared format B: Contract interface manifest

**Purpose:** a machine-readable description of what a contract does, what it accepts, and what it publishes. Consumed by type generation (Release 6), Offer Lab (Release 9) and Studio.

**Non-negotiable principle:** the manifest is *derived* from what contracts already declare. Agoric contracts define their public and creator facets with `M.interface(...)` guards, and durable objects with `zone.exo` / `zone.exoClass` / `zone.exoClassKit`. Those guards already state method names and parameter/return shapes. The manifest is a projection of them, plus a small amount of metadata the guards cannot express.

**Stage 0 delivers the format only.** The generator that reads guards and produces manifests is Release 6 (Stage 2). Writing the spec first, then validating it by hand-authoring manifests for two example contracts, tells us whether the format is sufficient before we invest in a generator.

**Manifest sections (v0):**

| Section | Source | Notes |
|---|---|---|
| `contract` | package.json + bundle hash | Name, version, bundle id. |
| `facets.public`, `facets.creator` | `M.interface` guards | Method name, param patterns, return pattern, `call` vs `callWhen`. Patterns serialised in a documented subset of the `@endo/patterns` vocabulary. |
| `invitations` | Invitation-maker methods on facets | Name, expected proposal shape (`give`/`want` keywords and brands), offer-args shape, exit rules. |
| `published` | vstorage paths written by the contract | Path template, value schema if known. |
| `terms`, `privateArgs` | `start` function signature and `meta` | Required capabilities and issuers. This is the seed of the "capability report" Preflight will produce. |
| `traces` | Optional | Trace event kinds the contract emits, linking format A and B. |

**Deliverables:** JSON Schema, TypeScript type, validator, two hand-authored manifests (one for the Offer Up contract, one for an orchestration-basics contract), a spec page, and a short design note sent to the Agoric liaison for comment before Stage 1 ends.

**Postponed formats (recorded so nobody re-litigates):** chain-capability manifest (the Probe's JSON output will grow into it) and failure-scenario format (nothing consumes it until a failure lab exists).

## 1.6 CI and conventions

- Lint, type-check, unit tests on every package; `@endo/ses-ava` for tests so code runs under lockdown from day one.
- A "hardened JS smoke" job that bundles `examples/` contracts with `@endo/bundle-source` and runs them under SES. This is the seed of Preflight's own test suite.
- Conventional commits, changesets for versioning, automated changelog. Every package publishes to npm under one scope.
- `AGENTS.md` at the root, kept in sync with the skill pack by a test that fails if they diverge.

## 1.7 Stage 0 work breakdown

| Day | Work | Done when |
|---|---|---|
| 1 | Confirm the npm scope; create `DCFoundation/aagentic-tooling`; licence, workspace root, CI skeleton. | `yarn install && yarn test` passes on an empty tree in CI. |
| 2 | CLI shell: subcommand registry, config layering, `--json` output, error type, `--version`, `schemas list`. | CLI installs globally and runs; unit tests for config precedence. |
| 3 | Format A: schema, types, validator, fixtures, spec page. | Fixtures validate; a deliberately broken fixture fails. |
| 4 | Format B: schema, types, validator, spec page; hand-author the Offer Up manifest. | Manifest validates and a reviewer can read it and correctly describe the contract from it alone. |
| 5 | Second hand-authored manifest (orchestration contract); docs site scaffold; SES smoke job; design note to Agoric liaison. | Docs publish from CI; note sent. |

## 1.8 Stage 0 definition of done

- A stranger can clone the repo, run one command, and see the CLI respond.
- Both schemas are published with fixtures and a human-readable spec.
- Two hand-authored manifests exist and were validated by someone other than the author.
- Chris has received the format design note (a reply is not required to proceed, but is required before Release 6).
- CI is green and enforces lint, types, tests and the SES smoke job.
