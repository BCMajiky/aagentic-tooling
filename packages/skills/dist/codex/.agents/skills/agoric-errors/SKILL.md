---
name: agoric-errors
description: "The Agoric error catalogue: for each known failure, the message to match (or that it is silent), the cause and the fix, grouped by topic with the silent ones first. Load when an Agoric, Zoe, orchestration, Endo or deploy error appears, or when something succeeds and nothing happens. Do not load to learn an API from scratch; the topic skills cover that."
---

# Agoric error catalogue

Every known failure, grouped by topic. Within a topic the **silent** ones come first: no error, a hang, or a success code with nothing done. Check those when nothing is visibly wrong; for the rest, search for a distinctive part of the message. When a message matches more than one entry, the more specific entry applies: PATTERN_MISMATCH is the fallback for any pattern failure without its own entry.

Rendered from `packages/core/src/hints.ts` in aagentic-tooling, the catalogue the `aat` CLI reads: 50 entries. Cause and fix for each are in the topic's reference file.

## Hardened JavaScript

Full entries: `references/hardened-js.md`

- **PASS_STYLE_NOT_FROZEN**: contains `Cannot pass non-frozen objects like`
- **FAR_NON_METHOD**: contains `cannot serialize Remotables with non-methods like`
- **SES_TAMED_DATE_RANDOM**: matches `secure mode Calling %SharedDate%\.now\(\) throws|secure mode %SharedMath%\.random\(\) throws`
- **PATTERN_MISMATCH**: matches ` - Must (be|have|not|fail|match)`

## Zoe contracts

Full entries: `references/zoe-contract.md`

- **CUSTOM_TERMS_SHAPE_LOCATION**: silent
- **CUSTOM_TERMS_SHAPE_MISSING**: silent
- **PROPOSAL_SHAPE_MISSING**: silent
- **PUBLIC_FACET_AUTHORITY**: silent
- **ZOE_EXPORTED_MISSING**: matches `Cannot find file for internal module "\./exported\.js".*@agoric/zoe/`
- **ATOMIC_REARRANGE_HELPER**: matches `import\s*\{[^}]*\batomicRearrange\b[^}]*\}\s*from\s*'@agoric/zoe/src/contractSupport`
- **OFFER_SAFETY_VIOLATION**: contains `Offer safety was violated by the proposed allocation`
- **PROPOSAL_SHAPE_MISMATCH**: matches `" proposal: .* - Must be`
- **OFFER_HANDLER_UNDEFINED_REASON**: contains `If an offerHandler throws, it must provide a reason of type Error`

## Durable state and upgrade

Full entries: `references/durable-state.md`

- **CONTRACT_NOT_UPGRADABLE**: silent
- **MAKEONCE_MISSING**: silent
- **DURABLE_KIND_SUBSET**: silent
- **EXO_METHOD_ADDED_NO_EFFECT**: silent
- **REDEPLOY_ID_COLLISION**: silent
- **DURABLE_STATESHAPE_MISMATCH**: contains `durable Kind stateShape mismatch`
- **START_VALUES_NOT_DURABLE**: contains `values from start() must be durable`
- **DURABLE_VALUE_NOT_DURABLE**: contains `value is not durable`

## Orchestration

Full entries: `references/orchestration.md`

- **OFFER_RESULT_NOT_CONTINUING**: silent
- **EXIT_WAIVED_NO_RECOVERY**: silent
- **FLOW_REFUND_MISSING**: silent
- **GETCHAIN_AT_START**: silent
- **HOST_RETURNS_PROMISE**: silent
- **PUBLISH_READ_AFTER_AWAIT**: silent
- **FLOW_STATE_RACE**: silent
- **SPLIT_PAYOUT_PARTIAL_FAILURE**: silent
- **E_IN_FLOW**: contains `guest eventual applyMethod not yet supported: `
- **VSTORAGE_PATH_SEGMENT_INVALID**: contains `Path segment names must consist of`

## Testing

Full entries: `references/testing.md`

- **TEST_BUNDLE_BYPASS**: silent
- **TEST_IMPORT_WORKAROUND**: silent
- **TEST_TOOLS_REIMPLEMENTED**: silent
- **TEST_HAND_MOCKED_ORCHESTRATOR**: silent
- **TEST_RAW_AVA**: silent
- **ENDO_ERRORS_BEFORE_SES**: contains `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'`
- **VATDATA_UNAVAILABLE**: contains `VatData unavailable`
- **ORCH_TEST_TOOLS_TS**: contains `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`
- **CHAINHUB_DENOM_UNREGISTERED**: contains `ensure it is registered in chainHub`

## Project setup and deploy

Full entries: `references/deploy.md`

- **CHAIN_BUNDLE_INSTALL_UNDERGASSED**: silent
- **WALLET_SPEND_WITHOUT_ALLOW_SPEND**: silent
- **BOARD_ID_HARDCODED**: silent
- **PAY_DENOM_HARDCODED**: silent
- **DEVNET_TIMER_WAKEUP_MISSING**: silent
- **ENDO_MULTIPLE_SES**: contains `TypeError: Cannot redefine property: sliceToImmutable`
- **YARN_PNP_DEFAULT**: matches `EROFS: read-only filesystem, mkdir '/node_modules/bundles'|Your application tried to access @endo/\S+, but it isn't declared in your dependencies`
- **BUNDLE_UNDECLARED_DEP**: matches `Cannot find external module "[^"]+" in package`
- **CHAIN_PAYLOAD_TOO_LARGE**: contains `413 Payload Too Large`

## Other

Full entries: `references/other.md`

- **SES_HARNESS_ENDOWMENTS**: silent

## Not carried over

Devnet sharp edges (from the Servandum contract work) that are not entries above, and why. Every other sharp edge is an entry.

- **Sharp edge 3.** Returning `JSON.stringify(result)` from a flow was a FiDeal-specific smart-wallet workaround, not a rule; upstream returns a hardened continuing offer from a flow. See [`agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.flows.js#L34`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/examples/basic-flows.flows.js#L34).
- **Sharp edge 4.** Keeping state in the invitation handler rather than the flow is a FiDeal architecture choice, not a failure mode; where durable state belongs is in agoric-durable-state. See skill `agoric-durable-state`.
- **Sharp edge 6.** Harden everything that crosses a boundary: already covered by PASS_STYLE_NOT_FROZEN and the pack rules. See `PASS_STYLE_NOT_FROZEN`.
- **Sharp edge 11.** Wakeup handlers using `async wake()` with `E()` were an accepted risk in Servandum, and the note itself asks whether seatless flows now cover the case; not checked at u23a.
- **Sharp edge 12.** Authorising by a self-reported `offerArgs` address is the standard pattern, recorded as a review note, not a failure.
- **Sharp edge 20.** Lockfiles going stale after a package rename is generic package-manager behaviour, not specific to Agoric.
- **Sharp edge 21.** A case-sensitive constant misuse in an untested wakeup path is an ordinary coding bug caught by review, not an Agoric failure mode.
