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

Sharp edge 1 (`docs/context/agoric-devnet-sharp-edges.md`) records the same
symptom from devnet: the offer stays in `liveOffers` and no transfer happens.
Its explanation (that `E()` makes the runner treat a raw vow as complete, so
the send is never issued) does not match u23a's source; the panic above does.
Neither version has been reproduced end to end in this repository.

The fix is the same either way: call `account.transfer(…)` directly and await
it, as `examples/send-anywhere/src/send-anywhere.flows.js` does.
