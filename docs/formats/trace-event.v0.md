# Shared format A: workflow trace events, v0

**Status:** v0, Stage 0 day 3.
**Schema:** [`packages/schemas/schemas/trace-event.v0.schema.json`](../../packages/schemas/schemas/trace-event.v0.schema.json)
**Fixtures:** [`packages/schemas/fixtures/trace-event/v0/`](../../packages/schemas/fixtures/trace-event/v0/)
**Validator:** `validateTraceEvent` from `@dcfoundation/aat-schemas`

## What it is for

A standard record of *what happened, in what order, on which chain*, for an
Agoric orchestration flow. It is consumed by VowScope (Release 7), Studio,
Sentinel and Event Relay.

It does **not** say how contracts emit these events — that is VowScope's job —
or how they get off-chain. It is a data shape and nothing else.

## Why OpenTelemetry

The structure is borrowed rather than invented: trace id, span id, parent span
id, start and end, attributes, status. Three reasons.

1. Developers already understand it.
2. An orchestration flow maps onto it cleanly. A flow is a trace; each vow,
   timer wait, ICA call and IBC acknowledgement is a span; the parent link is
   the causal chain you actually want to see.
3. Existing viewers can render it after a shallow transform, which matters
   before VowScope exists.

No OpenTelemetry code is included and there is no dependency on it.

### Where it deliberately differs

| | OpenTelemetry | Here | Why |
|---|---|---|---|
| Times | `startTimeUnixNano`, string nanoseconds | `startTime`, `endTime`, RFC 3339 UTC | These are hand-authored and hand-read at this stage. A converter is a one-liner. |
| Ordering | wall clock | `agoric.block.height` | On a chain the block is the real order. Two spans in the same block have no meaningful clock ordering between them, and a validator's clock is not a source of truth. |
| Status codes | `Unset`, `Ok`, `Error` | `unset`, `ok`, `error` | Lowercase, to match every other enumerated string in this format. |
| Span kind | `internal`/`client`/`server`/… | absent | Nothing consumes it and `agoric.event.kind` is the distinction that matters here. Addable later as a minor bump. |
| Self-description | none | `schema: "trace-event.v0"` | These end up as lines in a log. A line that cannot say what it is costs more than the 26 bytes it saves. |

## The envelope

```json
{
  "schema": "trace-event.v0",
  "traceId": "abcdef0123456789abcdef0123456789",
  "spanId": "0000000000000001",
  "parentSpanId": null,
  "name": "sendIt",
  "startTime": "2026-09-16T14:00:00.000Z",
  "endTime": "2026-09-16T14:01:12.000Z",
  "status": { "code": "ok" },
  "attributes": {
    "agoric.event.kind": "custom",
    "agoric.chain.id": "agoriclocal",
    "agoric.block.height": 210000
  }
}
```

| Field | Rule |
|---|---|
| `schema` | Always `trace-event.v0`. |
| `traceId` | 32 lowercase hex. One trace per flow. |
| `spanId` | 16 lowercase hex. |
| `parentSpanId` | 16 lowercase hex, or `null` for the root span. Must not equal `spanId`. |
| `name` | Non-empty. The flow function or the method invoked. |
| `startTime` | RFC 3339 UTC ending in `Z`. |
| `endTime` | Same, or `null` while the span is open. Must not precede `startTime`. |
| `status.code` | `unset`, `ok` or `error`. |
| `status.message` | Required when `code` is `error`, forbidden otherwise. |
| `attributes` | Scalars only. See below. |

Two consistency rules tie `status` and `endTime` together, because a span that
gets them out of step is worse than no span at all:

- `endTime` is `null` **iff** `status.code` is `unset`.
- `vow.resolved` must be `ok`; `vow.rejected` and `ibc.timeout` must be `error`.

Top-level fields are a closed set. Per-event detail goes in `attributes`; if the
envelope is allowed to grow, two producers end up with incompatible traces that
both "validate".

## Event kinds

Sixteen, fixed by the plan table and unchanged:

| Kind | Also requires |
|---|---|
| `timer.set` | `agoric.timer.abs.value` or `agoric.timer.rel.value` |
| `timer.fired` | `agoric.timer.abs.value` |
| `vow.pending` | — |
| `vow.resolved` | `status.code: ok` |
| `vow.rejected` | `status.code: error` |
| `ica.send` | `agoric.chain.address` |
| `ica.ack` | `agoric.chain.address` |
| `icq.query` | `agoric.connection.id` |
| `icq.result` | `agoric.connection.id` |
| `ibc.transfer` | `agoric.channel.id`, `agoric.denom` |
| `ibc.ack` | `agoric.channel.id`, `agoric.packet.sequence` |
| `ibc.timeout` | `agoric.channel.id`, `agoric.packet.sequence`, `status.code: error` |
| `offer.received` | `agoric.offer.id` |
| `offer.exited` | `agoric.offer.id` |
| `flow.restarted` | `agoric.flow.id`, `agoric.flow.state` |
| `custom` | — |

Per-kind requirements are deliberately thin: only what is definitional. A
transfer that does not yet know its sequence number is perfectly ordinary, which
is why `agoric.packet.sequence` is required on the acknowledgement and the
timeout but not on the send.

## Attributes

Three are required on every event:

| Attribute | Type | Meaning |
|---|---|---|
| `agoric.event.kind` | enum | Which kind, from the table above. |
| `agoric.chain.id` | string | The chain this span acts on. Not necessarily Agoric. |
| `agoric.block.height` | integer | The authoritative ordering key. |

The rest are optional. Names were taken from the orchestration exos at
`upstream/agoric-sdk-u23/packages/orchestration/src/exos/`, commit `cc25a29`
(tag `agoric-upgrade-23a`), so that instrumentation does not have to invent
them. `packages/schemas/src/trace-event/attributes.ts` records the upstream
field each one came from.

| Attribute | Type | From |
|---|---|---|
| `agoric.contract.instance` | string | plan §1.4 |
| `agoric.flow.id` | string | async-flow flow exo identity |
| `agoric.flow.name` | string | the exported flow function, e.g. `sendIt` |
| `agoric.flow.state` | string | `getFlowState()`: `Running`, `Sleeping`, `Replaying`, `Failed`, `Done` |
| `agoric.retry.attempt` | integer | plan §1.4 |
| `agoric.exo.label` | string | `zone.exoClassKit` first argument |
| `agoric.exo.facet` | string | facet **key** in the behavior record |
| `agoric.exo.method` | string | the method invoked |
| `agoric.operation` | string | `opName` in `ibc-packet.js` |
| `agoric.chain.name` | string | ChainHub name passed to `orch.getChain()` |
| `agoric.chain.address` | string | `CosmosChainAddress.value` |
| `agoric.chain.address.encoding` | string | `CosmosChainAddress.encoding` |
| `agoric.account.id` | string | `${namespace}:${reference}:${address}` |
| `agoric.connection.id` | string | `IBCConnectionInfo.id` |
| `agoric.channel.id` | string | `transferChannel.channelId` |
| `agoric.port.id` | string | `transferChannel.portId` |
| `agoric.counterparty.channel.id` | string | `counterPartyChannelId` |
| `agoric.counterparty.port.id` | string | `counterPartyPortId` |
| `agoric.ibc.local.address` | string | `localAddress` |
| `agoric.ibc.remote.address` | string | `remoteAddress` |
| `agoric.packet.sequence` | decimal string | `sequence` |
| `agoric.packet.timeout.height` | decimal string | `timeoutHeight` |
| `agoric.packet.timeout.timestamp` | decimal string | `timeoutTimestamp` |
| `agoric.packet.ack` | string | packet `acknowledgement` |
| `agoric.denom` | string | `DenomAmount.denom` |
| `agoric.denom.base` | string | `DenomInfo.baseDenom` |
| `agoric.amount.value` | decimal string | `DenomAmount.value` |
| `agoric.timer.abs.value` | decimal string | `TimestampRecord.absValue` |
| `agoric.timer.rel.value` | decimal string | `RelativeTimeRecord.relValue` |
| `agoric.offer.id` | string | smart wallet offer id |

### Three rules about attributes

**Values are scalars.** String, finite number or boolean. A nested value does
not join or index across traces, so `{ denom, value }` is flattened into
`agoric.denom` and `agoric.amount.value`.

**Anything that is `Nat` or `bigint` upstream is a decimal string.** JSON has one
number type and it is a double. A packet sequence, an amount, or a timeout
timestamp in nanoseconds does not survive it.

**The `agoric.*` namespace is closed.** An unregistered `agoric.*` name is an
error. The point of the namespace is that a name means the same thing
everywhere: an emitter writing `agoric.chainId` instead of `agoric.chain.id`
should hear about it rather than quietly producing traces nothing can join
against. Anything outside the `agoric.` prefix is free-form and passes through
untouched, so applications can attach their own correlation ids without asking
anyone.

### Two upstream inconsistencies this format resolves

These are worth knowing about, because they are why some names here do not
match the code they came from character for character.

**Port and channel identifiers are spelled three ways upstream**, depending on
the layer: `portId`/`channelId` in ChainHub's `transferChannel`,
`portID`/`channelID` in the ICA traffic entry, and
`source_port`/`source_channel` in the raw IBC packet. There is no canonical
upstream spelling. This format normalises to `agoric.port.id` and
`agoric.channel.id`.

**Exo facet keys and `M.interface` labels are not reliably equal.** In
`cosmos-orchestration-account.js` the facet `pickDataWatcher` is labelled
`pickArrayDataWatcher`; in `local-orchestration-account.js` the facet
`transferWithMetaWatcher` is labelled `transferWatcher`, which collides with a
sibling facet's label. Keys are unique, labels are not, so `agoric.exo.facet`
is the key.

## Versioning

- **Additive changes bump the minor version.** A new optional attribute, a new
  event kind, a loosened constraint. Existing valid events stay valid.
- **Breaking changes bump the major version, and the old schema file stays in
  the tree.** `trace-event.v0.schema.json` is not deleted when
  `trace-event.v1.schema.json` arrives, because data written against v0 outlives
  the decision to move on.
- The `schema` field carries the major version only (`trace-event.v0`), so a
  minor bump does not invalidate stored events.
- Adding a name to the closed `agoric.*` registry is additive. **Removing or
  renaming one is breaking.**

## Fixtures

Five valid, in `fixtures/trace-event/v0/valid/`. Each is one connected trace
with exactly one root span.

| File | What it traces |
|---|---|
| `timer-wait.json` | A flow sets a timer and is woken by it. Modelled on `undelegate`, which sleeps out the unbonding period. |
| `ica-send-with-ack.json` | `delegate` over an interchain account: the send, and the ack that settles it. |
| `vow-rejection.json` | An ICS20 transfer times out and the vow rejects. The error text is the one `ibc-packet.js` actually produces. |
| `flow-restart.json` | A flow restarts across an upgrade. Same `traceId` and `agoric.flow.id` on both sides; the `agoric.flow.state` changes. |
| `multi-hop-send-anywhere.json` | The USDC branch of `sendIt` from the real send-anywhere contract: offer, local transfer, IBC to Noble, CCTP `depositForBurn`, seat exit. |

Twelve invalid, in `invalid/`, each paired in the test with the code it must
report — so a fixture that starts failing for a *different* reason is a test
failure, not a silent pass. See that directory's README for the table.

## Using the validator

```ts
import { validateTraceEvent } from '@dcfoundation/aat-schemas';

const result = validateTraceEvent(candidate);
if (!result.valid) {
  for (const issue of result.issues) {
    console.error(`${issue.path} ${issue.code}: ${issue.message}`);
  }
}
```

Every issue is collected rather than stopping at the first, because the reader
is usually fixing a file and one problem per run is slow. Each issue carries a
JSON Pointer, a stable code and a sentence naming the value it objected to.

The result is hardened. On success the returned `event` *is* the input object,
so the input is hardened too; validate a copy if you mean to keep editing.

### Why the validator is hand-written

`packages/schemas` is imported by every later tool, so a runtime dependency here
is a dependency everywhere, and the schema is small and fixed. The deciding
reason is error messages: `--json` output and the skill pack need a code, a
pointer and a sentence. A generic validator says "must match schema
`#/properties/attributes`".

The JSON Schema file remains the normative artifact for anyone outside this
repository. A test asserts that the two agree on everything that can drift — the
event kinds, the attribute names, the required fields and the version — so they
cannot fall out of step silently.

## Open questions for the design note

- Should `agoric.exo.facet` be the facet key (as here) or the `M.interface`
  label? Keys are unique and labels are not, but the labels are what a reader
  sees in an error message.
- Is the closed `agoric.*` namespace too strict for a first version? The
  alternative is a warning rather than an error, at the cost of letting
  misspellings into stored data where they cannot be fixed.
- Should a span carry the vat incarnation number, so traces spanning an upgrade
  can be told apart from traces spanning a restart within one incarnation?
