# Agoric error catalogue

Every known failure, grouped by topic. Within a topic the **silent** ones come first: no error, a hang, or a success code with nothing done. Check those when nothing is visibly wrong; for the rest, search for a distinctive part of the message. When a message matches more than one entry, the more specific entry applies: PATTERN_MISMATCH is the fallback for any pattern failure without its own entry.

Rendered from `packages/core/src/hints.ts`: 50 entries.

## Hardened JavaScript

### PASS_STYLE_NOT_FROZEN

**Match:** contains `Cannot pass non-frozen objects like`

**Cause:** An object crossing a vat or marshal boundary (method result, offer result, stored value, argument) was not hardened.

**Fix:** Call `harden()` on the value before it leaves the function.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L173` · skill `agoric-hardened-js`

### FAR_NON_METHOD

**Match:** contains `cannot serialize Remotables with non-methods like`

**Cause:** A `Far` object carries a property that is not a function.

**Fix:** Keep data out of remotables. Expose it through a method (`getPrice: () => price`) or return a copyRecord.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L170-L172` · skill `agoric-hardened-js`

### SES_TAMED_DATE_RANDOM

**Match:** matches `secure mode Calling %SharedDate%\.now\(\) throws|secure mode %SharedMath%\.random\(\) throws`

**Cause:** Contract code called `Date.now()` or `Math.random()`. Under lockdown in a compartment both throw, because contract execution must be deterministic.

**Fix:** Take time from the timer service (`E(timer).getCurrentTimestamp()`) passed in `privateArgs`. Take randomness from nowhere: design it out.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contracts/priceAggregator.js#L157`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contracts/priceAggregator.js#L157) · `aagentic-tooling/scripts/ses-smoke.mjs` · skill `agoric-hardened-js`

### PATTERN_MISMATCH

**Match:** matches ` - Must (be|have|not|fail|match)`

**Cause:** A value did not match the `@endo/patterns` shape passed to `mustMatch`, an interface guard, `customTermsShape` or a store `valueShape`. The label before the first colon says which check failed.

**Fix:** Read the path in the message (for example `offerArgs: chainName: number 42 - Must be a string`) and fix the value or the pattern.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L79` · skill `agoric-hardened-js`

## Zoe contracts

### CUSTOM_TERMS_SHAPE_LOCATION

**Match:** silent

**Cause:** A `customTermsShape` placed anywhere other than the exported `meta` is ignored, so terms are never validated. At u23 ZCF reads it from `meta` only, and checks it lazily inside `zcf.getTerms()`.

**Fix:** Export `meta = harden({ customTermsShape })` from the contract module. A bad term then fails `zcf.getTerms()` with `customTerms: … - Must be …`. For a shape that is missing altogether, see CUSTOM_TERMS_SHAPE_MISSING.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L88-L94` · [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L358-L368`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L358-L368) · `CUSTOM_TERMS_SHAPE_MISSING` · skill `agoric-zoe-contract`

### CUSTOM_TERMS_SHAPE_MISSING

**Match:** silent

**Cause:** The contract exports no `meta.customTermsShape` and checks terms by hand, or not at all. Malformed terms are accepted at `startInstance`.

**Fix:** Export `meta = harden({ customTermsShape })`. If a shape exists but is not in `meta`, see CUSTOM_TERMS_SHAPE_LOCATION.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L88-L94` · `CUSTOM_TERMS_SHAPE_LOCATION` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PROPOSAL_SHAPE_MISSING

**Match:** silent

**Cause:** `zcf.makeInvitation` is called without a `proposalShape`, so Zoe escrows any proposal and the handler has to refuse bad ones by hand after escrow.

**Fix:** Pass a `proposalShape` as the fourth argument. Zoe checks it before escrow (`zoeService/offer/offer.js`), and a bad offer fails with `"<description>" proposal: … - Must be: …`.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L126-L130` · `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L166-L167` · [`agoric-sdk@cc25a29:packages/zoe/src/zoeService/offer/offer.js#L45-L60`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/zoeService/offer/offer.js#L45-L60) · `PROPOSAL_SHAPE_MISMATCH` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PUBLIC_FACET_AUTHORITY

**Match:** silent

**Cause:** A per-principal or administrative method sits on `publicFacet`, which anyone holding the instance can reach with `E(zoe).getPublicFacet(instance)`.

**Fix:** Put it on `creatorFacet` or on a per-principal facet or continuing invitation. See the POLA section lifted from agoric-sdk in the zoe-contract skill.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L66` · skill `agoric-zoe-contract`

### ZOE_EXPORTED_MISSING

**Match:** matches `Cannot find file for internal module "\./exported\.js".*@agoric/zoe/`

**Cause:** `@agoric/zoe/exported.js` does not exist at u23; older tutorials import it for its ambient types. The bundle still builds, so the failure appears when the bundle is evaluated: on chain the install succeeds and `startInstance` fails.

**Fix:** Delete the import. Import `ZCF`, `OfferHandler` and friends as types from `@agoric/zoe` with a JSDoc `@import`.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L57-L60` · `aagentic-tooling/examples/offer-up/README.md` · skill `agoric-zoe-contract`

### ATOMIC_REARRANGE_HELPER

**Match:** matches `import\s*\{[^}]*\batomicRearrange\b[^}]*\}\s*from\s*'@agoric/zoe/src/contractSupport`

**Cause:** The `atomicRearrange(zcf, transfers)` helper from `@agoric/zoe/src/contractSupport` is deprecated at u23 and only forwards to the ZCF method. It works; it is the old idiom. Also a baseline output defect (task 1, Claude).

**Fix:** Call `zcf.atomicRearrange(harden([...transfers]))` and drop the import.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractSupport/atomicTransfer.js#L47-L54`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractSupport/atomicTransfer.js#L47-L54) · [`agoric-sdk@cc25a29:packages/orchestration/src/utils/zoe-tools.js#L81`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/utils/zoe-tools.js#L81) · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### OFFER_SAFETY_VIOLATION

**Match:** contains `Offer safety was violated by the proposed allocation`

**Cause:** A reallocation would leave a seat with neither what it wanted nor what it gave. Zoe refuses the whole rearrangement.

**Fix:** Move the wanted amount to the seat (mint it, or transfer it from another seat) in the same `zcf.atomicRearrange` that takes its payment.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L143-L152` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PROPOSAL_SHAPE_MISMATCH

**Match:** matches `" proposal: .* - Must be`

**Cause:** The offer's proposal does not match the invitation's `proposalShape`. Zoe rejects it before escrow.

**Fix:** Make the offer match the shape, or widen the shape if the contract really accepts that proposal.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/zoeService/offer/offer.js#L45-L49`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/zoeService/offer/offer.js#L45-L49) · `PROPOSAL_SHAPE_MISSING` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### OFFER_HANDLER_UNDEFINED_REASON

**Match:** contains `If an offerHandler throws, it must provide a reason of type Error`

**Cause:** An offer handler threw `undefined` (for example a bare `throw;` or a rejected promise with no reason).

**Fix:** Throw an `Error`: `throw Fail`…`` or `throw makeError(…)`. ZCF fails the seat with it and the offerer gets a full refund.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L206-L214`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L206-L214) · skill `agoric-zoe-contract`

## Durable state and upgrade

### CONTRACT_NOT_UPGRADABLE

**Match:** silent

**Cause:** The contract exports `start` returning `Far` facets over closure state, with no `meta.upgradability`, no durable zone and no exos. Zoe does not refuse an upgrade, but non-durable facets are abandoned and closure state is gone, so clients lose their references and funds held in closure seats are unreachable.

**Fix:** Export `meta = harden({ upgradability: 'canUpgrade' })`, take `baggage` as the third `start` argument, build a durable zone with `makeDurableZone(baggage)` and make facets with `zone.exo`.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contracts/valueVow.contract.js#L9-L37`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contracts/valueVow.contract.js#L9-L37) · [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L15`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L15) · skill `agoric-durable-state` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### MAKEONCE_MISSING

**Match:** silent

**Cause:** A long-lived object (an orchestration account, a vow kit, a singleton) is created with a plain call in contract start, so every incarnation creates a new one and the previous one, with anything it holds, is orphaned.

**Fix:** Create it with `zone.makeOnce('name', () => make())`, which runs the maker only on first start and returns the stored value after an upgrade.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L104-L109` · skill `agoric-durable-state`

### DURABLE_KIND_SUBSET

**Match:** silent

**Cause:** An upgrade redefined a durable kind with fewer facets or methods than the previous incarnation. Objects of that kind already held by clients or stored durably keep their identity, and calls to the missing methods fail. Upstream forbids it; the exact error text was not reproduced at u23a.

**Fix:** Redefine every durable kind with the same facets and methods or a superset. Retire a method by keeping it and making it throw a clear error.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L62) · skill `agoric-durable-state`

### EXO_METHOD_ADDED_NO_EFFECT

**Match:** silent

**Cause:** Unverified devnet observation (sharp edge 9): a method added to a `zone.exo` public facet did nothing after redeploying under the same label, and a fresh label was used to get around it. It conflicts with the upstream upgrade rule, which allows a superset of methods, and it is not known whether the redeploy was an upgrade or a new instance. To be tested by the week 2 upgrade task.

**Fix:** Do not rename exo labels on upgrade; follow the upstream rule (same facets and methods or a superset). If a new method seems to have no effect, check whether the contract was upgraded or a new instance was started, and record the case against this entry.

**See:** devnet sharp edge 9 · [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L62) · `DURABLE_KIND_SUBSET` · `aagentic-tooling/packages/skills/src/agoric-durable-state/references/upgrade-rules.md`

### REDEPLOY_ID_COLLISION

**Match:** silent

**Cause:** Unverified devnet observation (sharp edge 10): a fresh instance restarts its counters, so records published as `…-1` overwrite the previous deployment's vstorage nodes.

**Fix:** Carry an id prefix as a term (`v2-1`) and treat the terms on chain as the truth; the repository can carry a different prefix from the deployed instance.

**See:** devnet sharp edge 10 · skill `agoric-durable-state`

### DURABLE_STATESHAPE_MISMATCH

**Match:** contains `durable Kind stateShape mismatch`

**Cause:** An upgrade redefined a durable exo class with a `stateShape` that is not compatible with the one recorded by the previous incarnation.

**Fix:** Keep existing state fields and their shapes. Add new fields only as optional, and migrate lazily.

**See:** [`agoric-sdk@cc25a29:packages/swingset-liveslots/src/virtualObjectManager.js#L270-L300`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-liveslots/src/virtualObjectManager.js#L270-L300) · skill `agoric-durable-state`

### START_VALUES_NOT_DURABLE

**Match:** contains `values from start() must be durable`

**Cause:** A contract declares `meta.upgradability: 'canUpgrade'` but `start` returns a facet that is not durable, typically a `Far` object.

**Fix:** Make every facet `start` returns a `zone.exo` (or another durable object) from a zone built on the baggage.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L452-L461`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L452-L461) · `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L124-L140` · skill `agoric-durable-state`

### DURABLE_VALUE_NOT_DURABLE

**Match:** contains `value is not durable`

**Cause:** A durable store or durable exo state was given a heap object: a `Far` object, a plain closure or a promise.

**Fix:** Store only passable data and durable objects (zone exos, other durable stores, vows). Make the `Far` object a `zone.exo`.

**See:** [`agoric-sdk@cc25a29:packages/swingset-liveslots/src/collectionManager.js#L61`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-liveslots/src/collectionManager.js#L61) · skill `agoric-durable-state`

## Orchestration

### OFFER_RESULT_NOT_CONTINUING

**Match:** silent

**Cause:** A flow returns an orchestration account object as the offer result. A smart-wallet user receives a remotable with nothing to act on. Idiom confirmed from upstream; wallet-side behaviour not run.

**Fix:** Return `account.asContinuingOffer()` so the offerer gets `invitationMakers` for the account.

**See:** [`agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.flows.js#L34`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/examples/basic-flows.flows.js#L34) · skill `agoric-orchestration` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### EXIT_WAIVED_NO_RECOVERY

**Match:** silent

**Cause:** The proposal shape requires `exit: { waived: null }` and the contract has no recovery facet. If the flow never settles (ICA channel never opens, relayer down, a failed activation), the offerer can never exit and the funds cannot be recovered.

**Fix:** Do not require a waived exit unless there is a recovery path. send-anywhere constrains only `give`.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L131-L136` · skill `agoric-orchestration` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### FLOW_REFUND_MISSING

**Match:** silent

**Cause:** A flow moved funds from the seat into a local account, the next step failed, and the flow exited or failed the seat without moving the funds back. The offerer is paid nothing and the funds stay in the contract account.

**Fix:** On failure after `localTransfer`, call `withdrawToSeat(account, seat, give)` before `seat.fail(error)`.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L101-L107` · skill `agoric-orchestration`

### GETCHAIN_AT_START

**Match:** silent

**Cause:** Unverified. A chain lookup (`orch.getChain('agoric')`) ran in an orchestrated flow that contract start awaited, instead of in a flow run later by an offer. Reported on devnet to hang contract start (sharp edge 7); not reproduced at u23a.

**Fix:** Look chains up inside the flow that needs them, and pass per-network values such as the pay denom as terms.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L43-L45` · devnet sharp edge 7 · skill `agoric-orchestration`

### HOST_RETURNS_PROMISE

**Match:** silent

**Cause:** Unverified. Host-side orchestration code (an exo method or a function passed into a flow context) returned a promise instead of a vow. Promises do not survive an upgrade, so a flow waiting on one cannot be replayed. No error was found at u23a in heap-zone tests; upstream states the rule without a diagnostic.

**Fix:** Return vows: wrap cross-vat work in `vowTools.watch(E(x).method())` or `vowTools.asVow(async () => …)`.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L69-L71` · skill `agoric-orchestration`

### PUBLISH_READ_AFTER_AWAIT

**Match:** silent

**Cause:** Unverified design rule from devnet (sharp edge 2): data a flow read from durable records after an `await` came back as empty objects or stale values, so what it published was wrong.

**Fix:** Read and serialise everything the flow will publish synchronously, before its first `await`.

**See:** devnet sharp edge 2 · skill `agoric-orchestration`

### FLOW_STATE_RACE

**Match:** silent

**Cause:** Unverified design rule from devnet (sharp edge 5): flows yield at every `await`, so two activations can read the same record status and both act on it.

**Fix:** Re-read the record immediately before each `store.set` and throw if its status changed since the flow read it.

**See:** devnet sharp edge 5 · skill `agoric-orchestration`

### SPLIT_PAYOUT_PARTIAL_FAILURE

**Match:** silent

**Cause:** Unverified design rule from devnet (sharp edge 13): a flow that pays two parties and fails between the payments can pay the first party again when it is retried.

**Fix:** Pay the first party, record a terminal state, then pay the second inside try/catch with a pending flag, so a retry cannot repeat the first payment.

**See:** devnet sharp edge 13 · skill `agoric-orchestration`

### E_IN_FLOW

**Match:** contains `guest eventual applyMethod not yet supported: `

**Cause:** An orchestration flow used `E()` (eventual send) on an object it received from the host, such as an orchestration account. At u23a the replay membrane does not support eventual sends from a guest, so the activation panics into the Failed state. The offerer sees an offer that never settles, seat still open; the panic is in the vat log, because async-flow's default panic handler rethrows it. Reported on devnet as sharp edge 1; the mechanism here is from u23a source. Not reproduced end to end.

**Fix:** Call account and chain methods directly and `await` them: `await account.transfer(dest, amount)`. The flow runner handles the vows.

**See:** [`agoric-sdk@cc25a29:packages/async-flow/src/replay-membrane.js#L349`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/replay-membrane.js#L349) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L195-L201`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L195-L201) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L58-L60`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L58-L60) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L313`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L313) · `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L122-L131` · devnet sharp edge 1 · skill `agoric-orchestration`

### VSTORAGE_PATH_SEGMENT_INVALID

**Match:** contains `Path segment names must consist of`

**Cause:** A vstorage node name contains a character other than ASCII alphanumerics, underscore and dash (a dot, for example), or is empty or over 100 characters. `makeChildNode` throws. On devnet this was seen as silent (sharp edge 8), because the publish ran inside a vow nothing watched, so the rejection was never observed.

**Fix:** Build node names from `[a-zA-Z0-9_-]`, 1 to 100 characters (`escrow-1`, not `escrow.1`), and watch the vow that publishes so a failure is seen.

**See:** [`agoric-sdk@cc25a29:packages/internal/src/lib-chainStorage.js#L108-L111`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/internal/src/lib-chainStorage.js#L108-L111) · [`agoric-sdk@cc25a29:packages/internal/src/lib-chainStorage.js#L204`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/internal/src/lib-chainStorage.js#L204) · devnet sharp edge 8 · skill `agoric-orchestration`

## Testing

### TEST_BUNDLE_BYPASS

**Match:** silent

**Cause:** `bundleAndInstall(moduleNamespace)` with an imported module instead of a path goes through `bundleTestExports`: the contract is never bundled or evaluated in a compartment, so a contract that cannot bundle still passes. Severity low. It is acceptable only where a separate bundle check runs, as the SDK's CI does; a fresh dapp has no such check.

**Fix:** Unless the project has its own bundle check, pass a file path: `bundleAndInstall(new URL("../src/x.contract.js", import.meta.url).pathname)`, or bundle with `@endo/bundle-source` and `E(zoe).install(bundle)`.

**See:** [`agoric-sdk@cc25a29:packages/zoe/tools/setup-zoe.js#L69-L84`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/tools/setup-zoe.js#L69-L84) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_IMPORT_WORKAROUND

**Match:** silent

**Cause:** Test modules loaded through top-level `await import()` after the test-environment import, a workaround for ENDO_ERRORS_BEFORE_SES that is unnecessary once the environment import is first and the workspace uses the node-modules linker.

**Fix:** Import `@agoric/zoe/tools/prepare-test-env-ava.js` first, then use ordinary static imports.

**See:** `ENDO_ERRORS_BEFORE_SES` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_TOOLS_REIMPLEMENTED

**Match:** silent

**Cause:** The orchestration test tools (`setupOrchestrationTest`, network fakes, IBC mocks) were hand-ported into the project instead of imported, because they ship as TypeScript. The port drifts from upstream on every SDK bump.

**Fix:** Import them from `@agoric/orchestration/tools/*.ts` with the `ts-blank-space` loader (see ORCH_TEST_TOOLS_TS).

**See:** `ORCH_TEST_TOOLS_TS` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_HAND_MOCKED_ORCHESTRATOR

**Match:** silent

**Cause:** Tests drive the flow through a hand-built orchestrator with `Far` fakes, bypassing `withOrchestration`, ChainHub, the real account exos and the IBC mocks. Everything passes under conditions no chain provides. The Servandum suites are the same mistake.

**Fix:** Start the real contract with `setupOrchestrationTest` from `@agoric/orchestration/tools/contract-tests.ts` and drive acknowledgements and timeouts with its `transmitVTransferEvent`.

**See:** skill `agoric-testing` · [`agoric-sdk@cc25a29:packages/orchestration/tools/contract-tests.ts`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/tools/contract-tests.ts) · `aagentic-tooling/docs/context/agoric-devnet-sharp-edges.md` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### TEST_RAW_AVA

**Match:** silent

**Cause:** A test file uses ava's own `test` (`import test from 'ava'`) with the SES environment loaded through ava's `require`. Lockdown runs, but the test function is not wrapped by `@endo/ses-ava`, so SES error reporting is lost.

**Fix:** Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js`, which is `wrapTest` from `@endo/ses-ava`.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/tools/prepare-test-env-ava.js`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/tools/prepare-test-env-ava.js) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### ENDO_ERRORS_BEFORE_SES

**Match:** contains `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'`

**Cause:** A module that uses `@endo/errors` was evaluated before lockdown installed `assert`.

**Fix:** Make the SES environment the first import (in tests, `@agoric/zoe/tools/prepare-test-env-ava.js`; in scripts, `@endo/init`).

**See:** skill `agoric-testing` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### VATDATA_UNAVAILABLE

**Match:** contains `VatData unavailable`

**Cause:** Zoe or durable-state code ran under plain lockdown without the SwingSet test environment, which provides `VatData`.

**Fix:** Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js` rather than setting up `@endo/init` yourself.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/tools/prepare-test-env-ava.js`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/tools/prepare-test-env-ava.js) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### ORCH_TEST_TOOLS_TS

**Match:** contains `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`

**Cause:** `@agoric/orchestration/tools/*.ts` ship as TypeScript. Node refuses to strip types under `node_modules`, and the package lists `ts-blank-space` only as a devDependency, so consumers do not get the loader.

**Fix:** Add `ts-blank-space` (0.6.2, matching the package's `^0.6.2`) as a devDependency and run ava with `nodeArguments: ['--loader=ts-blank-space/register', '--no-warnings']`. Verified with 0.6.2 on Node 22 and 24 by `packages/skills/snippets/test/loader.test.js`.

**See:** skill `agoric-testing` · [`agoric-sdk@cc25a29:packages/orchestration/package.json#L95-L98`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/package.json#L95-L98) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### CHAINHUB_DENOM_UNREGISTERED

**Match:** contains `ensure it is registered in chainHub`

**Cause:** An orchestration flow looked up a denom or brand ChainHub does not know. In tests, the usual cause is that `setupOrchestrationTest`'s `commonPrivateArgs` carry no `assetInfo`; on chain, that the contract was started without the asset's `assetInfo`.

**Fix:** Pass `assetInfo` built with `assetOn(denom, chainName, brand)` in privateArgs, so `registerChainsAndAssets` registers it; in tests also register the asset in the fake bank and `vbankAsset`.

**See:** `aagentic-tooling/packages/skills/snippets/test/support.js#L39-L74` · skill `agoric-testing`

## Project setup and deploy

### CHAIN_BUNDLE_INSTALL_UNDERGASSED

**Match:** silent

**Cause:** A bundle install was sent with `--gas auto` or a fixed gas below 100000000. The transaction returns success and installs nothing (sharp edges 14 and 15). Reported on devnet; not reproduced here.

**Fix:** Install with `--gas 100000000`, then query the chain for the bundle id before submitting the CoreEval.

**See:** devnet sharp edge 14 · devnet sharp edge 15 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L15-L24` · skill `agoric-deploy`

### WALLET_SPEND_WITHOUT_ALLOW_SPEND

**Match:** silent

**Cause:** A wallet action that gives payments was submitted without `--allow-spend`, so it went as `MsgWalletAction`. The transaction returns code 0, the offer is rejected, nothing moves (sharp edge 17).

**Fix:** Submit fund-moving offers with `agd tx swingset wallet-action --allow-spend`, as the `agoric` CLI does.

**See:** devnet sharp edge 17 · [`agoric-sdk@cc25a29:packages/agoric-cli/src/commands/wallet.js#L180-L182`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/agoric-cli/src/commands/wallet.js#L180-L182) · skill `agoric-deploy`

### BOARD_ID_HARDCODED

**Match:** silent

**Cause:** A client hardcodes a board id or instance handle. Both change on every deploy (sharp edge 18).

**Fix:** Look them up in `published.agoricNames` after each deploy.

**See:** devnet sharp edge 18 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L42-L46` · skill `agoric-deploy`

### PAY_DENOM_HARDCODED

**Match:** silent

**Cause:** Contract or client code hardcodes a pay denom. It differs per network: `ibc/toyusdc` on devnet, the Noble USDC IBC denom on mainnet (sharp edge 19).

**Fix:** Pass the denom as a term or in `assetInfo`; take the network value from `aat config show` or `networks.json` and check `published.agoricNames.vbankAsset`.

**See:** devnet sharp edge 19 · `aagentic-tooling/packages/core/src/networks.json#L30-L40` · skill `agoric-deploy`

### DEVNET_TIMER_WAKEUP_MISSING

**Match:** silent

**Cause:** Unverified devnet observation (sharp edge 22): timer wakeups did not fire on the shared devnet. An infrastructure problem, not a contract bug.

**Fix:** Check timer behaviour on a local chain before debugging contract timer logic against devnet.

**See:** devnet sharp edge 22 · skill `agoric-deploy`

### ENDO_MULTIPLE_SES

**Match:** contains `TypeError: Cannot redefine property: sliceToImmutable`

**Cause:** More than one copy of `ses` is installed because `@endo/*` versions drifted from the SDK tree, so two lockdown shims run.

**Fix:** Pin the whole `@endo/*` tree and `ses` through `resolutions`, copied from the u23 lockfile (`docs/PINS.md`). One line from `find node_modules -type d -path "*node_modules/ses"` means it is fixed.

**See:** `aagentic-tooling/docs/PINS.md` · skill `agoric-deploy`

### YARN_PNP_DEFAULT

**Match:** matches `EROFS: read-only filesystem, mkdir '/node_modules/bundles'|Your application tried to access @endo/\S+, but it isn't declared in your dependencies`

**Cause:** Yarn 4 with no `.yarnrc.yml` installs with Plug'n'Play. The Zoe test tools write bundles to a real `node_modules` path and SES tooling resolves real files, so both fail.

**Fix:** Add `nodeLinker: node-modules` to `.yarnrc.yml` and run `yarn install` again.

**See:** `aagentic-tooling/.yarnrc.yml#L1-L3` · skill `agoric-deploy` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### BUNDLE_UNDECLARED_DEP

**Match:** matches `Cannot find external module "[^"]+" in package`

**Cause:** `@endo/bundle-source` follows only the dependencies a package declares. A package that resolves in Node because it is hoisted into `node_modules` is still missing from the bundle.

**Fix:** Declare every package the contract imports (typically `@endo/patterns`, `@endo/errors`, `@endo/far`) in `dependencies`, at the versions in `resolutions`.

**See:** `aagentic-tooling/examples/send-anywhere/package.json` · skill `agoric-deploy` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### CHAIN_PAYLOAD_TOO_LARGE

**Match:** contains `413 Payload Too Large`

**Cause:** Public RPC rejects request bodies over about 1 MB (CometBFT `max_body_bytes`), which an uncompressed bundle exceeds (sharp edge 16). Reported on devnet; not reproduced here.

**Fix:** Compress the bundle before installing; a contract still over the limit needs the multi-bundle install pattern.

**See:** devnet sharp edge 16 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L22` · skill `agoric-deploy`

## Other

### SES_HARNESS_ENDOWMENTS

**Match:** silent

**Cause:** A contract fails under a local SES harness but runs on chain, or passes the harness and fails on chain, because the harness endows something different from what SwingSet gives a vat under XSnap: less (for example no `assert`) or more (for example `URL`, which chain vats do not have).

**Fix:** Endow what a vat gets under XSnap: `console`, `assert`, `HandledPromise`, `TextEncoder`, `TextDecoder` and `Base64`, and nothing else, as `scripts/ses-smoke.mjs` does. Node has no `Base64`, so the harness endows it as undefined. `URL` is not a vat global on chain; a contract must not rely on it.

**See:** `aagentic-tooling/scripts/ses-smoke.mjs#L130-L139` · [`agoric-sdk@cc25a29:packages/swingset-xsnap-supervisor/lib/supervisor-subprocess-xsnap.js#L255-L264`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-xsnap-supervisor/lib/supervisor-subprocess-xsnap.js#L255-L264) · [`agoric-sdk@cc25a29:packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83)

## Not carried over

Devnet sharp edges (from the Servandum contract work) that are not entries above, and why. Every other sharp edge is an entry.

- **Sharp edge 3.** Returning `JSON.stringify(result)` from a flow was a FiDeal-specific smart-wallet workaround, not a rule; upstream returns a hardened continuing offer from a flow. See [`agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.flows.js#L34`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/examples/basic-flows.flows.js#L34).
- **Sharp edge 4.** Keeping state in the invitation handler rather than the flow is a FiDeal architecture choice, not a failure mode; where durable state belongs is in agoric-durable-state. See skill `agoric-durable-state`.
- **Sharp edge 6.** Harden everything that crosses a boundary: already covered by PASS_STYLE_NOT_FROZEN and the pack rules. See `PASS_STYLE_NOT_FROZEN`.
- **Sharp edge 11.** Wakeup handlers using `async wake()` with `E()` were an accepted risk in Servandum, and the note itself asks whether seatless flows now cover the case; not checked at u23a.
- **Sharp edge 12.** Authorising by a self-reported `offerArgs` address is the standard pattern, recorded as a review note, not a failure.
- **Sharp edge 20.** Lockfiles going stale after a package rename is generic package-manager behaviour, not specific to Agoric.
- **Sharp edge 21.** A case-sensitive constant misuse in an untested wakeup path is an ordinary coding bug caught by review, not an Agoric failure mode.
