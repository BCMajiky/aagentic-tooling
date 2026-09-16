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
