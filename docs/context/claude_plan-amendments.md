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

