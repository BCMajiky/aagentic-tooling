# Plan amendments

Amendments to the plan of record (`stage0-plan.md`, extracted from
"Stage 0 and Release 1, Detailed Plan for Review", 14 September 2026).

Newest last. Where an amendment conflicts with the plan, the amendment wins;
where `STAGE0-BRIEF.md` conflicts with either, the brief wins.

## 2026-09-16, Stage 0 decisions

**§1.5 manifest subjects, decided.** Schema v0 carries `facets.<name>.guard` with values `interface` and `none`. Offer Up stays as the first subject with `guard: none`. Second subject is the SDK's `send-anywhere` at agoric-upgrade-23a, not orca. dapp-orchestration-basics is out of Stage 0.

**§2.3 toolchain pins, corrected.** Agoric packages pin to the `agoric-upgrade-23` dist-tag (zoe 0.28.0-u23.1, orchestration 0.3.0-u23.1), which is the current mainnet line, rather than the master clone's versions. Endo pins are read from the u23 dependency tree on day 1. Node 22 primary with 24 in the test matrix; yarn 4.17.1 via corepack. A second shallow clone of agoric-sdk at tag agoric-upgrade-23a is added under `upstream/` so read source matches installed packages.

**§1.2 npm scope.** `@dcfoundation` is the default, checked with `npm org ls dcfoundation` on day 1. Fallback `@aagentic`. All packages `private: true` through Stage 0.

**§1.7 and §1.8 remote and CI.** Private GitHub remote created day 1, CI verified in Actions, repo flipped to public and Pages enabled when §1.8 is met.

**Licence.** Apache-2.0 with a NOTICE file listing upstream sources and commits.

## 2026-09-16, day 1 findings

**D6 corrected.** SDK engines at agoric-upgrade-23a is ^20.9 || ^22.11, not ^22.11 || ^24.14 (that figure was read from master). Node 22 is the required CI leg; Node 24 runs as continue-on-error. Node 20 excluded, end of life April 2026.

**D1 Endo pins.** @endo/ses-ava 1.3.2 and @endo/bundle-source 4.1.2, forced by the u23 dependency tree. Top-level pins were insufficient; a resolutions block copied from upstream/agoric-sdk-u23/yarn.lock is required. Symptom of getting this wrong: TypeError: Cannot redefine property: sliceToImmutable. Candidate Release 1 catalogue entry.

**D4.** Branch protection requires GitHub Pro on private repos. Deferred to the public flip or DCF transfer. Squash-only merges applied.

## 2026-09-16, day 2 findings

**Config.** Added `aat config show` (resolved value plus source layer per key). Network resolution seeds endpoints before file and flag values, so `--network` overrides a file's endpoints and explicit flags override both. Unknown config keys and malformed env values are errors, not ignored. Testnet chain ids in networks.json are last-known and flagged; each entry carries its networkConfig URL for live verification. Mainnet entry carries no pay denom by design.

## 2026-09-16, day 3 findings

**Format A.** Sixteen event kinds as planned. Departures from OpenTelemetry: RFC 3339 times, agoric.block.height as ordering key, self-describing schema field. Nat/bigint values are decimal strings. Upstream port/channel spellings vary by layer (portId, portID, source_port); normalised to agoric.port.id and agoric.channel.id. Exo facet identity is the facet key, not the M.interface label, because labels collide upstream. The agoric.* namespace is closed; unregistered names are errors. Added agoric.vat.incarnation so restart and upgrade can be told apart. Validator is hand-written with a schema-drift test; the JSON Schema stays normative.

## 2026-09-16, day 4 findings

**Offer Up at u23.** @agoric/zoe/exported.js no longer exists (hard bundle failure, not a deprecation); types now import from @agoric/zoe and @agoric/ertp. The atomicRearrange helper is deprecated in favour of zcf.atomicRearrange; left as-is in the example, recorded as a Release 1 idiom. customTermsShape is read from meta only. Smoke harness endows exactly what SwingSet endows (console, assert, TextEncoder, TextDecoder and so on), nothing more.

**Format B.** 24-kind closed pattern vocabulary taken from the two subjects and zoe typeGuards; three structural kinds added: literal, exactRecord, ref. ref carries values that only exist at contract start (terms, brands). Offer Up's manifest has an empty facets section and a complete invitations section, which confirms D2: the offer surface is what clients need. bundleId is required and nullable; traces absent means not instrumented, traces: [] means instrumented and silent. examples/ is excluded from lint; the smoke job is its check.

## 2026-09-16, day 5 manifest reviews

**Both manifests reviewed by someone other than the author. Both passed, each with fixes applied.**

**Offer Up.** Two changes. `"open": false` was unexplained in the file; it now states what it means and points at the spec. And the contract transfers Price to an internal proceeds seat that nothing withdraws from — no creator facet, and no recovery by upgrade either since it uses start rather than prepare and holds no baggage — so proceeds are stranded for the contract's lifetime. Correction to an earlier claim of mine: the reviewer found this by reading offer-up.contract.js, NOT from the manifest. The manifest did not carry it and the format cannot express it. That is now open question 9 in the design note: a manifest cannot say where value ends up or who can withdraw it.

**send-anywhere.** One gap. `published` listed only the log node, but the contract starts with `withOrchestration(contract, { publishAccountInfo: true })`, which passes storageNode through to provideOrchestration; the chain facades then create a child node per orchestration account, named after the account's own address. Added: `published.{instancePath}.{localAccountAddress}` (LocalOrchestrationAccount writes the empty string, pending agoric-sdk#9066) and `published.{instancePath}.{nobleAccountAddress}` (CosmosOrchestrationAccount writes `{ localAddress, remoteAddress }`, the ICS-27 endpoint strings carrying port, channel and connection ids).

**Lesson for Release 6.** The send-anywhere gap is not an authoring slip: two of the three paths are written by @agoric/orchestration on the contract's behalf, gated on an option to withOrchestration. A generator that reads only the contract body will reproduce the same omission. It has to follow the start-helper wrapper.

## 2026-09-17, Release 1 decisions

**§2.2 delivery formats, decided.** One SKILL.md source per skill renders to `.claude/skills/` (Claude Code), `.agents/skills/` plus `agents/openai.yaml` (Codex), `.cursor/rules/*.mdc`, `.github/copilot-instructions.md` and the docs site. Seven skills: `agoric-hardened-js`, `agoric-zoe-contract`, `agoric-durable-state`, `agoric-orchestration`, `agoric-testing`, `agoric-deploy`, `agoric-errors`. Pack `AGENTS.md` budget is 2,000 tokens hard (o200k_base via `gpt-tokenizer`), replacing the 8k figure, because Codex now loads skills on demand.

**§2.3 snippet sources.** `examples/` at u23 plus `basic-flows`, `auto-stake-it`, `unbond` from the u23a clone. dapp-orchestration-basics excluded. Three sections of `agoric-sdk/AGENTS.md` at a2a3de9 lifted with attribution.

**§2.4 harness.** In-process on the published test tools (`setUpZoeForTest`, `setupOrchestrationTest`, `ibc-mocks`) in `packages/evals`. `multichain-testing` (Starship, Kubernetes) is not a v0.2 dependency; recorded as v0.3 candidate. Runner uses `claude -p` and `codex exec --json`.

**§2.6 week 1 baseline.** Plan tasks 1 and 4, prompts fixed in `RELEASE1-BRIEF.md` D1, run in workspaces outside the repo.

**§2.5 and §2.7 review gate.** Kris's review is replaced, until Agoric engages, by a correctness pass from the project session against u23a, recorded as "correctness pass, Agoric review pending". Applies retroactively to the Stage 0 manifest reviews.

## 2026-09-17, correction: Stage 0 manifest review status

The Stage 0 manifest reviews recorded on 16 September (day 5 manifest reviews) were done by the project session against the agoric-upgrade-23a source. They are reclassified as "correctness pass, Agoric review pending". The 16 September text stands as written.

## 2026-09-17, correction: where the exported.js failure surfaces

The day 4 entry says a leftover `@agoric/zoe/exported.js` import is a "hard bundle failure". It is not a bundle-time failure. With @endo/bundle-source 4.1.2 (the pinned version), `bundleSource` succeeds; the missing module is reported when the bundle is evaluated (`importBundle`, which is what the SES smoke job and a contract vat do): `Cannot find file for internal module "./exported.js" (with candidates …) in package file:///…/node_modules/@agoric/zoe/`. On chain that means the bundle installs and `startInstance` fails. Reproduced 2026-09-17 in this repo. The conclusion (delete the import) stands. The seed match text in RELEASE1-BRIEF.md (`Cannot find module '@agoric/zoe/exported.js'`) is not the text the pinned toolchain produces; `hints.ts` uses the reproduced text. The day 4 text stands as written; the same claim in `examples/offer-up/README.md`, the header comment of `examples/offer-up/src/offer-up.contract.js` and the design note appendix carries a correction.

## 2026-09-17, Release 1 day 2 findings

**Sharp edge 1, mechanism corrected.** At u23a an `E()` call from inside a flow is not treated as a completed await; the replay membrane rejects guest eventual sends outside async-flow's own tests and panics the activation into Failed with `guest eventual applyMethod not yet supported: …` (async-flow `replay-membrane.js` 346-350, `async-flow.js` 195-201). The flow never settles, so the offerer still sees a silent hang, and the rule (call account methods directly) stands. The diagnostic is recorded on the flow. Catalogue code `E_IN_FLOW` matches that text. Not reproduced end to end.

**Sharp edge 9, open.** `SwingSet/docs/vat-upgrade.md:62` at u23a allows an upgrade to redefine a durable kind with a superset of methods, which conflicts with the devnet report that a method added under the same exo label does nothing. The durable-state skill states the upstream rule and lists sharp edge 9 as unverified; it is not written as a rule until tested on a real upgrade.

**Catalogue refs.** Catalogue entries and skill sources cite repository paths, `agoric-sdk@<commit>:<path>` for the pinned clones, `catalogue:<CODE>` and `sharp-edge:<n>`, with optional line ranges. Tests resolve them; upstream refs and the word-for-word lift check run only where the clone exists, so CI does not check them.
