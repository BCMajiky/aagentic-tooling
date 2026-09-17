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
