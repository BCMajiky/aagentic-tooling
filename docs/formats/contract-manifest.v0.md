# Shared format B: contract interface manifest, v0

**Status:** v0, Stage 0 day 5. Both subjects hand-authored.
**Schema:** [`packages/schemas/schemas/contract-manifest.v0.schema.json`](../../packages/schemas/schemas/contract-manifest.v0.schema.json)
**Fixtures:** [`packages/schemas/fixtures/contract-manifest/v0/`](../../packages/schemas/fixtures/contract-manifest/v0/)
**Validator:** `validateContractManifest` from `@dcfoundation/aat-schemas`

## What it is for

A machine-readable description of what a contract does, what it accepts, and
what it publishes. Consumed by type generation (Release 6), Offer Lab
(Release 9) and Studio.

**The manifest is derived, not written.** Agoric contracts already declare their
facets with `M.interface` guards and their offer surface with `proposalShape`.
The manifest is a projection of those declarations, plus a small amount of
metadata the declarations cannot express. Stage 0 delivers the format only; the
generator is Release 6. Hand-authoring manifests for two real contracts first is
how we find out whether the format is sufficient before building a generator
against it.

## The `guard` field, and why unguarded facets are in

Offer Up's public facet is a bare `Far('Items Public Facet', { … })` with no
`M.interface` guard. That is not a reason to drop it (D2): it is the contract
every tutorial starts from, and a generator that fails on `Far()` facets fails
on most contracts in the wild.

So every facet carries a `guard`:

| `guard` | Source | What the manifest knows |
|---|---|---|
| `interface` | an `M.interface` guard | method names, `call` vs `callWhen`, parameter patterns, return patterns |
| `none` | the object literal passed to `Far` | **method names only** |

**What is lost with `guard: "none"`.** Nothing about argument or return types.
For Offer Up, the manifest cannot say that `makeTradeInvitation` takes no
arguments and returns a `Promise<Invitation>`, because the contract never says
so. The validator therefore *rejects* a `none` facet that carries `params`,
`returns` or `callKind`: inventing a signature is worse than admitting there
isn't one, because a generator will believe it. The `summary` field carries
prose for a human, and a consumer must not treat prose as a signature.

**What survives.** The `invitations` section, which is the part clients
actually need. `proposalShape` is passed to `zcf.makeInvitation` whether or not
the facet is guarded, so Offer Up's offer surface is fully described even though
its method surface is not. That asymmetry is the main thing hand-authoring
taught us, and it is the argument for keeping unguarded facets in scope.

## Sections

| Section | Derived from | Notes |
|---|---|---|
| `contract` | package.json + the bundle | `name`, `version`, `bundleId`. |
| `facets.<name>` | `M.interface` guards or the `Far` literal | `guard`, `label`, `methods`. |
| `invitations` | invitation-maker methods and their `proposalShape` | description, maker, proposal, offer args. |
| `published` | vstorage paths written while the contract runs, by it or on its behalf | Path template, value schema if known. |
| `terms`, `privateArgs` | `meta.customTermsShape` and the `start` signature | The seed of Preflight's capability report. |
| `traces` | optional | Trace event kinds emitted; the join to format A. |
| `notes` | nobody | Prose. The one section not derived. |

Three details worth stating because they cost time otherwise:

- **`contract.bundleId` is required and may be `null`.** `null` means "not
  bundled"; the field being absent means "somebody forgot". Those are different
  states and the format distinguishes them. A non-null value must be `b1-`
  followed by 128 lowercase hex characters, which is what `agd` computes as the
  sha512 of the bundle's `endoZipBase64`.
- **`traces` absent is not the same as `traces: []`.** Absent means the contract
  is not instrumented; empty means it is instrumented and emits nothing.
- **`published` is drawn at the bundle boundary, not at the source file.** It
  covers everything written while the contract runs, including what a library
  writes on its behalf: two of send-anywhere's three paths are written by
  `@agoric/orchestration`, not by any line in the contract. It excludes what the
  deploy script writes, which is why Offer Up's `published` is empty even though
  the dapp writes `published.boardAux.<boardId>` — that write lives in
  `offer-up-proposal.js`, a core-eval script that is not part of the bundle.
  Getting this boundary wrong in the obvious direction, by reading only the
  contract body, is what the send-anywhere review caught.

## Pattern vocabulary

Patterns are serialised as `{ "kind": … }` objects. The vocabulary is **closed**
and is exactly what the two Stage 0 subjects and
`agoric-sdk-u23/packages/zoe/src/typeGuards.js` use at commit `cc25a29`.

| Kind | `@endo/patterns` | Seen in |
|---|---|---|
| `any` | `M.any()` | zoe (16), offer-up |
| `string` | `M.string()` | zoe (26), send-anywhere |
| `boolean` | `M.boolean()` | zoe (1) |
| `bigint` | `M.bigint()` | offer-up `meta.customTermsShape` |
| `scalar` | `M.scalar()` | send-anywhere flows |
| `error` | `M.error()` | zoe (1) |
| `pattern` | `M.pattern()` | zoe (8) |
| `bag` | `M.bag()` | offer-up `want.Items.value` |
| `literal` | a bare value used as a pattern | send-anywhere `M.not(harden({}))` |
| `remotable` | `M.remotable('Brand')` | zoe (23) |
| `ref` | a named shape defined elsewhere | offer-up `AmountShape`, `tradePrice` |
| `promise` | `M.promise()` | zoe (19) |
| `eref` | `M.eref(x)` | zoe (16) |
| `opt` | `M.opt(x)` | zoe (3) |
| `await` | `M.await(x)` | zoe (8) |
| `not` | `M.not(x)` | send-anywhere |
| `record` | `M.record()` | zoe (4) |
| `exactRecord` | an object literal used as a pattern | offer-up `want.Items` |
| `splitRecord` | `M.splitRecord(req, opt, rest)` | zoe (14), both subjects |
| `recordOf` | `M.recordOf(k, v, limits)` | zoe (8), send-anywhere |
| `arrayOf` | `M.arrayOf(x, limits)` | zoe (6) |
| `or` | `M.or(…)` | zoe (2) |
| `and` | `M.and(…)` | zoe (1), send-anywhere |
| `gte` | `M.gte(x)` | offer-up `give.Price` |
| `undefined` | `M.undefined()` | send-anywhere creator facet `registerChain` |

### Anything outside this list is rejected

Not rendered as `any`, not dropped, not guessed at — rejected, with a message
listing the vocabulary. A manifest that silently renders an unknown pattern as
`any` tells a generator that a method accepts anything, which is strictly worse
than telling it nothing.

The visible consequence is that `gte` is here and `lt`, `lte` and `gt` are not.
That looks arbitrary and is deliberate: `M.gte` is the only comparison the two
subjects use. Adding its siblings is an additive change (minor bump) the first
time a real contract needs one.

`await` is valid **only** inside a method guard's parameter list. `M.await` in a
return position is not a thing, and a manifest claiming it would mislead a
generator.

### `ref`, and why not everything is inlined

`{ "kind": "ref", "name": "AmountShape", "module": "@agoric/ertp" }` names a
shape defined elsewhere. Without `module`, a `ref` names something defined
inside this document or created at start time — Offer Up's `tradePrice` is a
term of the contract, and `itemBrand` is created by
`zcf.makeZCFMint('Item', AssetKind.COPY_BAG)` and has no serialisable value at
authoring time. A generator will hit this constantly, so the format admits it
rather than pretending every pattern can be inlined.

## Example: the Offer Up invitation

```json
"proposal": {
  "give": { "Price": { "kind": "gte", "of": { "kind": "ref", "name": "tradePrice" } } },
  "want": {
    "Items": {
      "kind": "exactRecord",
      "entries": {
        "brand": { "kind": "ref", "name": "itemBrand" },
        "value": { "kind": "bag" }
      }
    }
  },
  "exit": { "kind": "any" },
  "open": false
}
```

Reading that back: a buyer gives at least `tradePrice` and wants some bag of
Items. `M.gte` means overpaying is allowed and underpaying is not.

## Versioning

Same rules as format A.

- **Additive is minor.** A new optional section, a new pattern kind, a loosened
  constraint. Existing valid manifests stay valid.
- **Breaking is major, and the old schema file stays in the tree.**
- Adding a pattern kind is additive; **removing or renaming one is breaking**.
- The `schema` field carries the major version only.

## Fixtures

Two valid, hand-authored, one for each `guard` value:

| File | Subject | Exercises |
|---|---|---|
| `valid/offer-up.json` | `examples/offer-up` | `guard: "none"`, `gte`, `bag`, `exactRecord`, module-less `ref` |
| `valid/send-anywhere.json` | `examples/send-anywhere` | `guard: "interface"`, both call kinds, `optionalParams`, resolvable `ref`, the raw proposal form |

Nine invalid in `invalid/`, each paired in the test with the code it must
report. The one that matters most is
`guardless-facet-with-patterns.json`: a `guard: "none"` facet claiming `params`
and `returns`, which is exactly the mistake D2 exists to prevent.

### What the second manifest changed

Hand-authoring `send-anywhere.json` found two gaps that Offer Up alone did not,
which is the argument for having insisted on two subjects:

- **`undefined` was missing from the vocabulary.** Its creator facet declares
  `registerChain: …returns(M.undefined())`. Nothing in Offer Up or in
  `zoe/src/typeGuards.js` uses `M.undefined()`, so the first pass missed it. A
  void method is common enough that the omission would have bitten Release 6.
- **`proposal` needed a raw form.** Offer Up's proposal shape names its
  keywords, so it projects cleanly into `give`/`want`. send-anywhere's is
  `M.splitRecord({ give: SingleNatAmountRecord })` — "exactly one give keyword,
  whatever it is called, holding any nat amount". There is no keyword to
  project, and projecting would mean inventing one. So `proposal` now takes
  **either** the projected form **or** a raw `shape`, never both: two
  statements that can disagree are worse than one that is general.

## Reviewer test

STAGE0-BRIEF.md: *someone who has not read the contract describes what it does
from the manifest alone and gets it right.* It is the real acceptance test for
this format; the validator only checks that a manifest is well formed, not that
it is true or useful.

**Offer Up: done, by someone other than the author. It passed.** Two changes
came out of it, both now in the manifest's `notes`:

1. `"open": false` was unexplained in the file. It now says what it means and
   points here.
2. Offer Up transfers `Price` to an internal proceeds seat that nothing ever
   withdraws from, so proceeds are stranded for the contract's lifetime.

**Where finding 2 came from matters, and it was not the manifest.** The reviewer
found it by reading the contract source. The manifest did not carry it, and
could not have: the format has no way to say "value moves here and nothing takes
it out". Read the manifest alone and you learn that a buyer gives `Price` and
gets `Items`, which is true and is not the whole story.

So the passing grade is on the stated test — describing what the contract does —
and not on the stronger claim that a manifest substitutes for reading the
source. Recorded because the difference is exactly the kind of thing that gets
rounded off later.

The gap itself is a candidate for v0.1; see the open questions.

**send-anywhere: done, by someone other than the author, checked against the
u23a source. It passed,** with one gap that has been fixed. `published` listed
only the `log` node, but the contract starts with
`withOrchestration(contract, { publishAccountInfo: true })`, and that flag is
what makes `withOrchestration` pass `storageNode` through to
`provideOrchestration`. The chain facades then create a child node per
orchestration account:

| Path | Written by | Value |
|---|---|---|
| `published.{instancePath}.log` | the contract, `E(storageNode).makeChildNode('log')` | a line of progress text per flow step |
| `published.{instancePath}.{localAccountAddress}` | `prepareLocalChainFacade` → `LocalOrchestrationAccount` | the empty string, pending agoric-sdk#9066 |
| `published.{instancePath}.{nobleAccountAddress}` | `prepareRemoteChainFacade` → `CosmosOrchestrationAccount` | `{ localAddress, remoteAddress }`, the ICS-27 endpoint strings carrying port, channel and connection ids |

Both account nodes are named after the account's own address, so the path
segment is not knowable until the contract runs — hence the placeholders.

**What this says about the format.** Nothing in the manifest was wrong; it was
incomplete, and incomplete in a way the author could not have caught by reading
the contract file alone. Two of the three paths are written by
`@agoric/orchestration` on the contract's behalf, gated on an option passed to
`withOrchestration`. A generator that reads only the contract source will make
exactly this mistake, so Release 6 has to follow the start-helper wrapper, not
just the contract body.

## Open questions for the design note

- Should `guard: "none"` facets be allowed to carry a `summary` at all? It is
  the only place prose can be mistaken for a signature.
- Is `ref` without a `module` too loose? It currently means "defined somewhere
  else", which a generator cannot resolve automatically.
- Should `published` distinguish paths the contract writes from paths its deploy
  script writes, rather than excluding the latter entirely? Offer Up's
  `boardAux` write is invisible in its manifest, and a reader may want it.
- Should a manifest be able to say where value ends up, and whether anything can
  get it back out? Offer Up's stranded proceeds are the case: the manifest
  describes the offer faithfully and still leaves a reader unable to see that
  the contract has no withdrawal path. Found by reading the source, which is
  what makes it a gap in the format rather than in that one manifest.
