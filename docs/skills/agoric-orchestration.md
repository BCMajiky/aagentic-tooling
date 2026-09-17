
# Orchestration

An orchestration contract is a Zoe contract wrapped by `withOrchestration`,
which gives it a durable zone and tools (`orchestrate`, `orchestrateAll`,
`chainHub`, `zoeTools`, `vowTools`). Long-running cross-chain work lives in
flows: async functions in a separate `*.flows.js` module that the async-flow
runner replays after upgrade. `aagentic-tooling/examples/send-anywhere` is the reference.

## Idioms

### Split contract and flows; look chains up inside flows

The contract module wires things up: `registerChainsAndAssets`, `orchestrate`
each flow with the host objects it needs, make invitations whose handler is
the orchestrated flow. The flows module does the chain work, including
`orch.getChain(...)`. Per-network values such as the pay denom come in as
terms or chain info, not from lookups at start.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L73-L122` `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L43-L45`

```js wrong=GETCHAIN_AT_START
const contract = async (zcf, privateArgs, zone, { orchestrate, vowTools }) => {
  const lookUpAgoric = orchestrate('lookUpAgoric', {}, async orch => {
    const agoric = await orch.getChain('agoric');
    return agoric.getChainInfo();
  });
  const agoricInfo = await vowTools.when(lookUpAgoric()); // awaited during start
```

**Produces:** silent. Unverified: reported on devnet to hang contract start (sharp edge 7); not reproduced at u23a.

### In a flow, call account methods directly

Inside a flow, orchestration accounts and chains are guest wrappers: call
`account.transfer(…)`, `chain.makeAccount()` and `account.getAddress()`
directly and `await` the result. `E()` is not supported there. The runner
panics the activation into the Failed state and the flow never settles. Why,
with source lines: `references/e-in-flows.md`.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L122-L131`

```js wrong=E_IN_FLOW
await E(sharedLocalAccount).transfer(dest, { denom, value: amt.value });
```

**Produces:** an offer that never settles; the panic `guest eventual applyMethod not yet supported: …` is in the vat log. Not reproduced end to end.

### Return the funds to the seat when a later step fails

`zoeTools.localTransfer(seat, account, give)` moves the offer's assets into a
contract account, and undoes itself if the deposit fails. After that, any
failure must call `zoeTools.withdrawToSeat(account, seat, give)` before
`seat.fail(error)`, or the offerer is paid nothing.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L101-L107` `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L126-L137`

```js wrong=FLOW_REFUND_MISSING
try {
  await account.transfer(dest, amount);
} catch (e) {
  seat.fail(e); // the funds are still in `account`
}
```

**Produces:** silent. The seat fails with an empty payout; the funds stay in the contract account.

### Hand an account to the offerer as a continuing offer

When the offerer should control a new account, return
`account.asContinuingOffer()` from the flow. A smart wallet turns that into
`invitationMakers` the user can act on. The raw account object gives a wallet
user nothing.

**Correct:** [`agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.flows.js#L28-L35`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/examples/basic-flows.flows.js#L28-L35)

```js wrong=OFFER_RESULT_NOT_CONTINUING
const account = await osmosis.makeAccount();
return account;
```

**Produces:** silent. The offer succeeds and the wallet user cannot use the result.

### Shape the proposal; leave the exit rule alone

Constrain `give` (and `want`) with a proposal shape. Do not require
`exit: { waived: null }` unless the contract has a recovery path: a flow can
stall on things outside the contract (an ICA channel that never opens, a
relayer that is down), and a waived exit then locks the offerer out.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L131-L136`

```js wrong=EXIT_WAIVED_NO_RECOVERY
zcf.makeInvitation(handler, 'fund', undefined, {
  give: { Funds: AnyNatAmountShape }, want: {}, exit: { waived: null },
});
```

**Produces:** silent until a flow stalls; then the funds cannot be recovered.

### Host code returns vows

Host-side code that a flow waits on (exo methods, functions passed in the
`orchestrate` context) returns vows, not promises, because a flow must be able
to resume waiting on it after an upgrade. Wrap cross-vat calls with
`vowTools.watch(E(x).method())`. Upstream states the rule below.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L69-L71`

```js wrong=HOST_RETURNS_PROMISE
const log = msg => E(logNode).setValue(msg); // a promise, passed to a flow
```

**Produces:** silent. Unverified: no error was found at u23a in heap-zone tests; the risk is at upgrade.

## Rules from agoric-sdk

Lifted word for word from agoric-sdk at commit a2a3de9 (Apache-2.0; see
`NOTICE`). The first is `.github/copilot-instructions.md` line 26.

<!-- lift: agoric-sdk@a2a3de9:.github/copilot-instructions.md#L26-L26 -->
- Always return vows rather than promises in orchestration code
<!-- /lift -->

The second is `AGENTS.md` lines 62 to 68. `packages/async-flow/docs/async-flow-states.md`
is in agoric-sdk.

<!-- lift: agoric-sdk@a2a3de9:AGENTS.md#L62-L68 -->
## Async-Flow Model Notes
- Async-flow runs each invocation as an activation with durable lifecycle states: `Running`, `Sleeping`, `Replaying`, `Failed`, `Done`.
- Upgrade-safe behavior depends on deterministic replay of prior host interactions; divergence during replay or invalid interactions can move an activation to `Failed`.
- `Done` means the activation outcome is settled and replay bookkeeping is dropped; logic that assumes continued activation state after completion is erroneous. Once the async-flow is done, any promises not yet settled will never see their reactions run. That's because the vow settling on the host side no longer translates into a settlement of the guest promise.
- Interleaving changes can also break replay: adding an `await` inside an async helper, or calling one without awaiting it immediately, can move later effects into a different turn and reorder them relative to the caller.
- For `*.flows.*` modules, keep replay behavior in mind and prefer code that is explicit about lifecycle boundaries and awaited dependencies.
- When reviewing `*.flows.*` modules, read `packages/async-flow/docs/async-flow-states.md`.
<!-- /lift -->

---

*Reference: `references/e-in-flows.md`*

# Why `E()` fails inside a flow

All citations are agoric-sdk at cc25a29 (tag `agoric-upgrade-23a`).

A flow runs as a guest behind a replay membrane
(`packages/async-flow/src/replay-membrane.js`). Host objects passed in, such as
orchestration accounts, reach the guest as wrappers whose direct method calls
are logged and replayed.

The membrane has code for guest eventual sends (`E(wrapper).method()`,
lines 242-300), but it is switched on only by `__eventualSendForTesting`
(line 45: "CAVEAT: Only for async-flow tests"). Production flows construct the
membrane without it (`packages/async-flow/src/async-flow.js`, lines 195-201).
Without it, an eventual send panics:

```text
guest eventual applyMethod not yet supported: <target>.<method> -> <promise>
```

(`replay-membrane.js` lines 348-349; `applyMethodSendOnly`, `applyFunction`
and `get` have matching messages.)

A panic moves the activation to the Failed state and isolates it from the host
(`async-flow.js` `panic`, from line 416; `docs/async-flow-states.md`). The
flow's outcome never settles, so an offer whose handler is that flow keeps its
seat open and its result unresolved. The panic is recorded on the flow
(`getFailures()`) and reaches the vat log: `withOrchestration` prepares
async-flow without a `panicHandler` (`orchestration/src/utils/start-helper.js`
lines 125-127), and the default handler rethrows (`async-flow.js` lines 58-60,
used at 313). Nothing reaches the offerer.

## How this relates to the devnet report

Sharp edge 1 (`aagentic-tooling/docs/context/agoric-devnet-sharp-edges.md`) records the same
symptom from devnet: the offer stays in `liveOffers` and no transfer happens.
Its explanation (that `E()` makes the runner treat a raw vow as complete, so
the send is never issued) does not match u23a's source; the panic above does.
Neither version has been reproduced end to end in this repository.

The fix is the same either way: call `account.transfer(…)` directly and await
it, as `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js` does.
