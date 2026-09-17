# Correctness pass, Agoric review pending

**Status:** correctness pass, Agoric review pending, findings applied

**Date:** 2026-09-17

**Commit reviewed:** `9fd3b2cfb930bfeff1091e186afaf8c760362fec` (`9fd3b2c`), the commit the review bundle was generated from.

**Reviewer:** the project session, against agoric-sdk at `cc25a29` (tag `agoric-upgrade-23a`), per RELEASE1-BRIEF.md D5. Agoric has not reviewed this; when Kris does, this note is amended, not replaced.

**Scope:** the seven rendered skills in `packages/skills/dist/claude/` with their references, the error catalogue in `packages/core/src/hints.ts`, and the consumer `AGENTS.md` in `packages/skills/dist/agents-md/`. The review bundle is those files concatenated in that order; it is a local file, not committed.

## Findings

Six findings from the project session, checked against agoric-sdk at cc25a29.
Findings 1 and 3 to 6 were applied in `0b4132c`; finding 2 in `1d01126`. CI
run 35237719770 passed on `0b4132c`.

### 1. Catalogue coverage of the 22 devnet sharp edges was incomplete

**Files:** `packages/core/src/hints.ts`, `packages/core/test/catalogue.test.ts`,
`packages/skills/src/render.ts` and its inputs, `packages/skills/src/agoric-durable-state/SKILL.md`,
the rendered `agoric-errors` in every target.

**Change:** only edges 1, 7, 9 and 14 to 19 were catalogue entries. Now:

- Edge 8 is `VSTORAGE_PATH_SEGMENT_INVALID`, literal
  `Path segment names must consist of`, citing `internal/src/lib-chainStorage.js`
  lines 108-111 (`assertPathSegment`) and 204 (`makeChildNode`), noting devnet
  saw it as silent because the publish ran inside an unwatched vow.
- Edges 2, 5 and 13 are silent unverified design rules:
  `PUBLISH_READ_AFTER_AWAIT`, `FLOW_STATE_RACE`, `SPLIT_PAYOUT_PARTIAL_FAILURE`.
- Edge 10 is `REDEPLOY_ID_COLLISION`, silent, unverified. `agoric-durable-state`
  now names that code, which makes its statement true.
- Edge 22 is `DEVNET_TIMER_WAKEUP_MISSING`, silent, unverified (our call).
- Edges 3, 4, 6, 11, 12, 20 and 21 are in `notCarriedOver` in `hints.ts`, each
  with a reason, rendered under "Not carried over" in `agoric-errors`. Edge 3's
  reason says the `JSON.stringify` flow return was a FiDeal-specific
  smart-wallet workaround, contradicted by `basic-flows.flows.js:34`, and not a
  rule. Edges 4, 6, 11, 12, 20 and 21 were our call.
- A test checks that each of the 22 edges is an entry or not carried over,
  exactly once.

**Commit:** `0b4132c`

### 2. The deploy material that skills cite lives in docs/context/

**File:** `docs/BEFORE-PUBLIC.md`

**Change:** a checklist item under "Move the internal planning docs out": before
the flip, move the deploy sequence to a first-party `docs/deploy-sequence.md`
keeping its devnet attribution, repoint every ref in the skill sources and
`hints.ts`, and re-render. The move is not done.

**Commit:** `1d01126`

### 3. The consumer AGENTS.md rule list was short

**Files:** `packages/skills/src/pack-rules.md`, `packages/skills/test/render.test.ts`,
rendered `agents-md/AGENTS.md` and `copilot/.github/copilot-instructions.md`.

**Change:** six rules added: return vows from host code a flow waits on;
compute what a flow publishes before its first `await`; vstorage path segments
are ASCII alphanumerics, underscores and dashes; install bundles with explicit
gas and query for the bundle id; fund-moving wallet actions need
`--allow-spend`; create singletons with `zone.makeOnce`. The finding asked for
ten; the existing five plus these six make **eleven**, all added as given.
`AGENTS.md` is 822 tokens of 2,000.

**Commit:** `0b4132c`

### 4. PATTERN_MISMATCH's regex also matched more specific failures

**Files:** `packages/core/src/hints.ts`, `packages/core/src/index.ts`,
`packages/core/test/catalogue.test.ts`, `packages/skills/src/render.ts`.

**Change:** the rule is stated in `hints.ts`: specific entries come before
generic ones and the first match wins. `PATTERN_MISMATCH` moved to the end of
the catalogue. No code path matched messages against the catalogue before, so
`findCatalogueEntry` was added to implement the rule. A test fails if any sample
message is claimed by an entry other than its own, and checks that a
`customTerms` failure falls through to `PATTERN_MISMATCH`. Moving
`PATTERN_MISMATCH` back to the front was confirmed to fail that test. The
`agoric-errors` index, which groups by topic, now says the more specific entry
applies.

**Commit:** `0b4132c`

### 5. GETCHAIN_AT_START's wrong snippet used orch where there was none

**File:** `packages/skills/src/agoric-orchestration/SKILL.md`, and the entry's
cause in `hints.ts`.

**Change:** the snippet is now an orchestrated flow that looks up the agoric
chain, awaited during contract start with `vowTools.when`.

**Commit:** `0b4132c`

### 6. Two entries overstated what was verified

**File:** `packages/core/src/hints.ts`

**Change:** `CHAIN_BUNDLE_INSTALL_UNDERGASSED` now says "Reported on devnet; not
reproduced here", the same wording as `CHAIN_PAYLOAD_TOO_LARGE`.
`SES_HARNESS_ENDOWMENTS` keeps `URL`, because `scripts/ses-smoke.mjs` endows it
(line 120), and cites the endowment block and SwingSet's
`manager-local.js:74-83`. That upstream block marks `URL` "Unavailable only on
XSnap" and `Base64` "Available only on XSnap"; chain vats run under XSnap, so
the entry now says a contract must not rely on `URL`. The smoke script itself
was not changed.

**Commit:** `0b4132c`

## Forward correction, after the skills-v0.1.0 tag

**The Stage 0 SES smoke harness endowed `URL`, which chain vats do not have.**
Finding 6 above kept `URL` in `SES_HARNESS_ENDOWMENTS` because
`scripts/ses-smoke.mjs` endowed it. That was the harness copying
`SwingSet/src/kernel/vat-loader/manager-local.js:74-83`, the local-worker
manager, whose own comments say `URL` is "Unavailable only on XSnap" and
`Base64` "Available only on XSnap". Chain vats run under XSnap, whose
endowments are `console`, `assert`, `HandledPromise`, `TextEncoder`,
`TextDecoder` and `Base64`
(`swingset-xsnap-supervisor/lib/supervisor-subprocess-xsnap.js:255-264` at
cc25a29).

`scripts/ses-smoke.mjs` now endows exactly that set, citing both files.
`Base64` is undefined in Node, so it is endowed as `globalThis.Base64`, as
upstream writes it. `HandledPromise` was added because the XSnap supervisor
grants it. `SES_HARNESS_ENDOWMENTS` is updated to match, and the pack is
re-rendered. No contract in `examples/` or the snippet corpus references `URL`,
and the smoke job passes on both examples and all five snippet contracts.
Tagged content (`skills-v0.1.0` at `23ca743`) carries the old entry text; the
correction is on `main` after the tag.

