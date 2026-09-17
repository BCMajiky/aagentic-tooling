# Two formats for Agoric orchestration tooling: a design note

**To:** Kris, Agoric
**From:** the DCF tooling work
**Date:** 16 September 2026
**Status:** request for comment. Nothing here is shipped, nothing depends on a
reply to keep moving, and everything is still cheap to change.

---

## Why you are getting this

The Decentralized Cooperation Foundation is building developer tooling for
Agoric — a CLI, a preflight checker, a trace viewer, an offer sandbox, and a
skill pack for coding agents. Most of those tools need to exchange two kinds of
data, so before building any of them we have defined the two data formats and
hand-authored examples against real contracts.

Two formats, both at v0:

- **Format A, workflow trace events.** What happened, in what order, on which
  chain, during an orchestration flow.
- **Format B, contract interface manifests.** What a contract accepts and what
  it publishes.

We have written the schemas, the validators, and worked examples using
`dapp-offer-up` and the SDK's own `send-anywhere`. Everything is pinned to
`agoric-upgrade-23a` (`cc25a29`), and the examples are bundled with
`@endo/bundle-source` and evaluated under `lockdown()` in CI, so the claims
below are tested rather than asserted.

**What would help most:** the one question in "The question we actually need
answered" at the end. Everything else is context, and a reaction to any part of
it is welcome but not blocking.

---

## Format A: we borrowed OpenTelemetry rather than inventing a shape

A trace event is an OpenTelemetry span with an Agoric attribute set:

```json
{
  "schema": "trace-event.v0",
  "traceId": "abcdef0123456789abcdef0123456789",
  "spanId": "0000000000000004",
  "parentSpanId": "0000000000000001",
  "name": "hop 1: agoric to noble",
  "startTime": "2026-09-16T14:00:01.100Z",
  "endTime": "2026-09-16T14:00:38.000Z",
  "status": { "code": "ok" },
  "attributes": {
    "agoric.event.kind": "ibc.transfer",
    "agoric.chain.id": "agoriclocal",
    "agoric.block.height": 210002,
    "agoric.flow.id": "flow-sendIt-0900",
    "agoric.channel.id": "channel-8",
    "agoric.denom": "ibc/usdc-on-agoric",
    "agoric.amount.value": "5000000",
    "agoric.packet.sequence": "512"
  }
}
```

An orchestration flow maps onto spans cleanly — a flow is a trace, and each vow,
timer wait, ICA call and acknowledgement is a span whose parent is its actual
cause. Developers already understand the shape, and existing viewers can render
it after a shallow transform, which matters while our own viewer does not exist.
No OpenTelemetry code is included and there is no dependency on it.

**Three places we deliberately diverge**, and we would rather hear now if any of
them looks wrong to you:

1. **`agoric.block.height` is the authoritative ordering key, not the clock.**
   Two spans in the same block have no meaningful wall-clock ordering between
   them, and a validator's clock is not a source of truth. Times are RFC 3339
   strings and are advisory.
2. **Times are RFC 3339, not `startTimeUnixNano`.** These are hand-authored and
   hand-read at this stage. The conversion is a one-liner if it ever matters.
3. **Each event carries `schema: "trace-event.v0"`.** These end up as lines in a
   log, and a line that cannot say what it is costs more than the bytes it
   saves.

### Attribute names come from your exos, not from us

The brief we are working to says to take attribute names from
`packages/orchestration/src/exos/` so that whatever instruments these later
already lines up. We did, and recorded the upstream field each name came from.

Two things forced a decision, and you may disagree with either:

**Port and channel identifiers are spelled three ways upstream**, depending on
layer: `portId`/`channelId` in ChainHub's `transferChannel`, `portID`/`channelID`
in the ICA traffic entry, and `source_port`/`source_channel` in the raw IBC
packet. There is no canonical spelling to adopt, so we normalised to
`agoric.port.id` and `agoric.channel.id` and documented the other two. If one of
those three is the intended canonical form, we would rather match it.

**Exo facet keys and `M.interface` labels are not reliably equal.** In
`cosmos-orchestration-account.js` the facet `pickDataWatcher` carries the label
`pickArrayDataWatcher`; in `local-orchestration-account.js` the facet
`transferWithMetaWatcher` carries the label `transferWatcher`, which collides
with a sibling facet's label. Keys are unique and labels are not, so
`agoric.exo.facet` is the key. The cost is that the trace does not say what a
runtime error message would say. We are not sure that is the right trade.

### The namespace is closed

An `agoric.*` attribute that is not in the registry is a validation error, not a
warning and not a passthrough. The mistake this is designed to catch is
`agoric.chainId` instead of `agoric.chain.id` — a trace that looks fine and
joins against nothing. Names outside the `agoric.` prefix are free-form, so
applications can attach their own correlation ids without asking anyone.

We are genuinely unsure this is right for a first version; see the open
questions.

---

## Format B: manifests, and the `Far()` problem

A manifest describes a contract's facets, its invitations and their proposal
shapes, what it publishes to vstorage, and its terms and private args. The
principle is that it is **derived, not written**: contracts already declare
their interface with `M.interface` guards and their offer surface with
`proposalShape`, and the manifest is a projection of those. A generator that
reads guards and emits manifests is planned; hand-authoring two first was how we
found out whether the format was sufficient.

### The decision we most want you to push back on

Offer Up's public facet is a bare `Far('Items Public Facet', { … })` with no
`M.interface` guard. The tempting move is to require guards and declare Offer Up
out of scope. We think that is wrong: it is the contract every tutorial starts
from, and a generator that fails on `Far()` facets fails on most contracts in
the wild.

So every facet carries a `guard`:

| `guard` | Source | What is known |
|---|---|---|
| `interface` | an `M.interface` guard | method names, `call` vs `callWhen`, parameter and return patterns |
| `none` | the object literal passed to `Far` | **method names only** |

And the validator **rejects** a `guard: "none"` facet that carries `params`,
`returns` or `callKind`. Inventing a signature is worse than admitting there
isn't one, because a generator will believe it.

**The interesting result.** Offer Up's `facets` section is nearly empty — one
method name and a prose summary. Its `invitations` section is *complete*:

```json
"proposal": {
  "give": { "Price": { "kind": "gte", "of": { "kind": "ref", "name": "tradePrice" } } },
  "want": {
    "Items": {
      "kind": "exactRecord",
      "entries": { "brand": { "kind": "ref", "name": "itemBrand" },
                   "value": { "kind": "bag" } }
    }
  },
  "exit": { "kind": "any" }
}
```

`proposalShape` is passed to `zcf.makeInvitation` whether or not the facet is
guarded. So the *offer surface* — which is what a client actually needs — is
fully described even when the method surface is not. That asymmetry is the main
thing hand-authoring taught us, and it is our argument for keeping unguarded
contracts in scope rather than requiring guards.

### The pattern subset, and `ref`

Patterns are serialised as `{ "kind": … }` objects over a **closed** vocabulary
of 25 kinds, which is exactly what our two subjects and
`packages/zoe/src/typeGuards.js` use at `cc25a29`. Anything outside it is
rejected rather than rendered as `any`: a generator told that a method accepts
anything is worse off than one told nothing.

The visible consequence is that `gte` is in the vocabulary and `lt`, `lte` and
`gt` are not, because `M.gte` is the only comparison our subjects use. That
looks arbitrary and is deliberate; adding the siblings is an additive change the
first time a real contract needs one. Hand-authoring the second manifest already
added one kind this way: `send-anywhere`'s creator facet returns
`M.undefined()`, which nothing in Offer Up or in `zoe/src/typeGuards.js` uses, so
the first pass missed it.

Three kinds are ours rather than yours, because the pattern vocabulary does not
have names for them: `literal` (a bare value used as a pattern, as in
`M.not(harden({}))`), `exactRecord` (an object literal used as a pattern), and
**`ref`**.

`ref` is the one worth your attention. Not every pattern can be inlined:

```json
{ "kind": "ref", "name": "InvitationShape", "module": "@agoric/zoe/src/typeGuards.js" }
{ "kind": "ref", "name": "tradePrice" }
```

With a `module`, a `ref` names an exported shape and a generator can resolve it.
Without one, it names something that only exists once the contract has started —
Offer Up's `tradePrice` is a term, and `itemBrand` is created by
`zcf.makeZCFMint('Item', AssetKind.COPY_BAG)`. Neither has a serialisable value
when a manifest is written. A generator will hit this constantly, so the format
admits it rather than pretending everything can be inlined. Whether a bare `ref`
is too loose is one of the open questions.

### One gap we found and have not closed

`send-anywhere` reads `zcf.getTerms().brands.USDC`, so it must be started with a
USDC issuer keyword. That is a real requirement of the contract, and the
manifest's `terms` section cannot express it: `terms` covers
`meta.customTermsShape`, and the standard `issuers`/`brands` terms are not part
of it. It is currently recorded in prose. If there is an idiomatic way a
contract declares "I need an issuer under this keyword", we would rather project
that than invent a section.

---

## Open questions

None of these block us. Numbered so a reply can be terse.

**On format A**

1. Are the orchestration exo interface guards in `exo-interfaces.ts` stable
   enough to treat as a source of truth for attribute names and, later, for
   manifests? If they are about to move, we would rather follow than diverge.
2. Should `agoric.exo.facet` be the facet key (as now, because keys are unique)
   or the `M.interface` label (what a reader sees in an error message)?
3. Is a closed `agoric.*` namespace too strict for a first version? The
   alternative is warning rather than erroring, at the cost of letting
   misspellings into stored data where they cannot be fixed.
4. Is there a canonical upstream spelling for port and channel identifiers that
   we should match instead of normalising?

**On format B**

5. Should a `guard: "none"` facet be allowed a prose `summary` at all? It is the
   one place prose can be mistaken for a signature.
6. Is a bare `ref` with no `module` too loose to be useful?
7. Should `published` distinguish paths the contract writes from paths its
   core-eval deploy script writes? Offer Up's `boardAux` write lives in
   `offer-up-proposal.js`, so it is invisible in the manifest, and a reader may
   want it.
8. Is there an idiomatic declaration of required issuer keywords that `terms`
   should project? (The `send-anywhere` gap above.)
9. Should a manifest be able to say **where value ends up and who can get it
   back out**? This came out of review. Offer Up transfers `Price` to an
   internal proceeds seat held in a local `const`, and nothing ever withdraws
   from it: there is no creator facet, and because the contract uses `start`
   rather than `prepare` and holds no baggage, a later upgrade cannot recover
   the funds either. Our manifest describes the offer faithfully — give
   `Price`, get `Items` — and a reader still cannot see any of that. The
   reviewer found it by reading the contract, not the manifest. We do not have
   a proposal here, and we are not sure the format is the right layer for it
   rather than a preflight check, but a manifest that cannot distinguish "pays
   into an account someone controls" from "pays into a hole" seems to be
   missing something a reader needs.
10. *(Added 2026-09-17.)* Do you want the dapp templates' tests to **bundle the
    contract from its path**? The SDK's example tests install with
    `bundleAndInstall(contractExports)`, which skips bundling; that is safe in
    the SDK because its CI bundles contracts separately. Outside developers
    copy the templates without that check, and a contract that cannot bundle
    then passes its tests. Bundling from the file path costs a few seconds per
    test file.
11. *(Added 2026-09-17.)* Should a skill pack **teach durable-by-default** for
    Zoe contracts? The dapp-offer-up template is not durable: `start` returns
    `Far` facets over closure state, with no `meta.upgradability` and no zone,
    so an upgrade abandons its facets and its proceeds. Agents copy that shape;
    in our baseline and dry run every Zoe contract written did. We now tell
    them to use `zone.exo` with an `M.interface` guard for any contract that
    will be deployed and kept, and to treat the template's `Far` facets as not
    the idiom to copy. If Agoric intends the template to stay non-durable for
    teaching, we would like to say that alongside it.

**Review status:** the Stage 0 manifest reviews referred to above were done by
the project session against the `agoric-upgrade-23a` source: correctness pass,
Agoric review pending.

---

## The question we actually need answered

**Question 1.** Everything else can be revised later at low cost. If the
orchestration exo interface guards are about to change shape, we would rather
know before a generator is built against them than after.

---

## Appendix: three findings that may be useful to you regardless

Turned up while pinning to `agoric-upgrade-23a`. Recording them in case they are
news; none is a complaint.

1. **`@agoric/zoe/exported.js` is gone at u23**, and `dapp-offer-up` at `4ea27c5`
   still imports it. It fails at **bundle time**, not type-check time, so a
   tutorial follower meets it as an opaque module-resolution error at the point
   of deploying. `dapp-offer-up` is pinned to u16-era versions and has not moved
   in over a year; it may be worth a bump. `@agoric/ertp/src/types.js` has
   likewise become `types.ts`.

   *Correction, 2026-09-17:* not at bundle time. With `@endo/bundle-source`
   4.1.2 the bundle builds, and the missing module is reported when the bundle
   is evaluated: `Cannot find file for internal module "./exported.js"`. On a
   chain that is an install that succeeds followed by a `startInstance` that
   fails, which is harder to diagnose than we said.
2. **`M.await` only makes sense in a parameter position**, which the pattern
   vocabulary does not encode. Our format enforces it separately.
3. **A guard in `cosmos-orchestration-account.js` has a typo**:
   `updateTxProgressWatcher` declares its optional key as `trafficeSlice` while
   callers pass and the body destructures `trafficSlice`. Harmless today because
   the key is optional, which is also why it has not been noticed.

---

*Everything described here is Apache-2.0 and the specs, schemas, validators and
worked examples can be shared as soon as the repository is public, which is days
rather than weeks away. Happy to walk through any of it live.*
