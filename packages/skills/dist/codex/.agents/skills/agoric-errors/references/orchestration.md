# Orchestration: error catalogue

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

**Cause:** Unverified. `orch.getChain('agoric')` (or another chain lookup) was awaited during contract start rather than inside a flow. Reported on devnet to hang contract start (sharp edge 7); not reproduced at u23a.

**Fix:** Look chains up inside the flow that needs them, and pass per-network values such as the pay denom as terms.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L43-L45` · devnet sharp edge 7 · skill `agoric-orchestration`

### HOST_RETURNS_PROMISE

**Match:** silent

**Cause:** Unverified. Host-side orchestration code (an exo method or a function passed into a flow context) returned a promise instead of a vow. Promises do not survive an upgrade, so a flow waiting on one cannot be replayed. No error was found at u23a in heap-zone tests; upstream states the rule without a diagnostic.

**Fix:** Return vows: wrap cross-vat work in `vowTools.watch(E(x).method())` or `vowTools.asVow(async () => …)`.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L69-L71` · skill `agoric-orchestration`

### E_IN_FLOW

**Match:** contains `guest eventual applyMethod not yet supported: `

**Cause:** An orchestration flow used `E()` (eventual send) on an object it received from the host, such as an orchestration account. At u23a the replay membrane does not support eventual sends from a guest, so the activation panics into the Failed state. The offerer sees an offer that never settles, seat still open; the panic is in the vat log, because async-flow's default panic handler rethrows it. Reported on devnet as sharp edge 1; the mechanism here is from u23a source. Not reproduced end to end.

**Fix:** Call account and chain methods directly and `await` them: `await account.transfer(dest, amount)`. The flow runner handles the vows.

**See:** [`agoric-sdk@cc25a29:packages/async-flow/src/replay-membrane.js#L349`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/replay-membrane.js#L349) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L195-L201`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L195-L201) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L58-L60`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L58-L60) · [`agoric-sdk@cc25a29:packages/async-flow/src/async-flow.js#L313`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/async-flow/src/async-flow.js#L313) · `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L122-L131` · devnet sharp edge 1 · skill `agoric-orchestration`
