
# Durable state

A contract vat is upgraded by starting new code against the old vat's durable
storage. Heap objects, closures and `Far` objects from the old incarnation are
gone; only what was stored through baggage survives. The rules below make a
contract upgradable from its first deploy, because they cannot be added
afterwards. Upstream reference: `SwingSet/docs/vat-upgrade.md` at u23a.

## Idioms

### Declare upgradability and build a zone on baggage

Export `meta = harden({ upgradability: 'canUpgrade' })`, take `baggage` as the
third `start` argument, and make a durable zone from it. With `canUpgrade`,
Zoe also checks that the facets `start` returns are durable. `prepare()` is the
deprecated spelling. Orchestration contracts get a durable zone from
`withOrchestration`.

**Correct:** [`agoric-sdk@cc25a29:packages/zoe/src/contracts/valueVow.contract.js#L9-L37`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contracts/valueVow.contract.js#L9-L37)

```js wrong=CONTRACT_NOT_UPGRADABLE
export const start = async zcf => {
  let sold = 0n;
  const publicFacet = Far('Shop', { makeBuyInvitation: () => … });
  return harden({ publicFacet });
};
```

**Produces:** silent until upgrade. Zoe does not refuse the restart, but `publicFacet` is abandoned and `sold` resets.

### Make facets and long-lived objects with zone exos

Use `zone.exo(label, interfaceGuard, methods)` for a singleton,
`zone.exoClass` for many instances with per-instance `state`, and
`zone.exoClassKit` for several facets sharing state. The interface guard
(`M.interface`) validates every call. A `Far` facet in a `canUpgrade` contract
is refused at start.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L124-L140` [`agoric-sdk@cc25a29:packages/orchestration/src/examples/staking-combinations.contract.js#L64-L71`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/examples/staking-combinations.contract.js#L64-L71)

```js wrong=START_VALUES_NOT_DURABLE
export const meta = harden({ upgradability: 'canUpgrade' });
export const start = async (zcf, _pa, baggage) => {
  const publicFacet = Far('Shop', { … });
  return harden({ publicFacet });
};
```

**Produces:** `with "canUpgrade", values from start() must be durable {…}`

### Create singletons once with `zone.makeOnce`

`start` runs again on every upgrade. Anything that must exist exactly once
(an orchestration account, a vow kit, a counter record) is created inside
`zone.makeOnce(name, maker)`, which runs the maker on first start and returns
the stored value afterwards.

**Correct:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L104-L109`

```js wrong=MAKEONCE_MISSING
const sharedLocalAccountP = makeLocalAccount(); // a new account every incarnation
```

**Produces:** silent. Each upgrade makes a new account; funds in the old one are orphaned.

### Keep durable stores to durable values, with shapes

Make stores from the zone (`zone.mapStore`, `zone.setStore`) with `keyShape`
and `valueShape`. They accept passable data and durable objects: zone exos,
other durable stores, vows. A `Far` object, a closure or a promise is refused.

**Correct:** [`agoric-sdk@cc25a29:packages/orchestration/src/exos/chain-hub.js#L275-L298`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/exos/chain-hub.js#L275-L298)

```js wrong=DURABLE_VALUE_NOT_DURABLE
const offers = zone.mapStore('offers');
offers.init(id, Far('Receipt', { getId: () => id }));
```

**Produces:** `value is not durable: … at slot 0 of …`

### Upgrade by redefining every kind with the same or more methods

On upgrade, redefine every durable kind the old code created, under the same
label, with the same facets and methods or a superset, never a subset. Keep
the `stateShape` compatible with the recorded one: add state fields only as
optional and migrate lazily. Do not rename labels to make a change take
effect. Sources in `references/upgrade-rules.md`.

**Correct:** [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L62)

```js wrong=DURABLE_STATESHAPE_MISMATCH
// v1: stateShape { price: AmountShape }
// v2:
zone.exoClass('Listing', ListingI, init, methods, {
  stateShape: { price: M.nat() },
});
```

**Produces:** `durable Kind stateShape mismatch (…)`

```js wrong=DURABLE_KIND_SUBSET
// v1 methods: makeBuyInvitation, getPrice
// v2:
zone.exo('Shop PF', ShopI, { makeBuyInvitation() { … } }); // getPrice dropped
```

**Produces:** silent at upgrade; clients that call `getPrice` on the existing facet fail. Exact error not reproduced.

## Devnet reports not yet checked against u23a

From `aagentic-tooling/docs/context/agoric-devnet-sharp-edges.md`. Sharp edge 10 is in the
catalogue as `REDEPLOY_ID_COLLISION` (silent, unverified).

- **Sharp edge 9, exo interfaces freeze on first creation.** The devnet report
  says a method added under the same exo label did nothing after redeploy.
  It is not a rule: the upgrade rule above is. It stays in the catalogue as an
  unverified observation (`EXO_METHOD_ADDED_NO_EFFECT`) until the week 2
  upgrade task tests it.
- **Sharp edge 10, prefix ids on redeploy.** A fresh instance restarts its
  counters, so vstorage records written as `…-1` overwrite the previous
  deployment's. Carry an id prefix term (`v2-1`) and treat the on-chain terms as
  the truth.

---

*Reference: `references/upgrade-rules.md`*

# Upgrade rules, with sources

All citations are agoric-sdk at cc25a29 (tag `agoric-upgrade-23a`).

## What survives an upgrade

`packages/SwingSet/docs/vat-upgrade.md`, "The Upgrade Sequence": non-durable
exported objects are abandoned, and the new code must re-define every durable
kind the old code created "with the same facets and methods or a superset
thereof" (line 62).

## What Zoe checks

`packages/zoe/src/contractFacet/zcfZygote.js`:

- A module that exports `prepare` is treated as `upgradability: 'canUpgrade'`;
  exporting both `start` and `prepare` fails, and so does `prepare` together
  with `meta.upgradability` (lines 268-287).
- With `canUpgrade` or `canBeUpgraded`, the facets and invitation `start`
  returns must be durable, or start fails with
  `with <upgradability>, values from start() must be durable` (300-302,
  452-461). Durable facets are saved to baggage (463-467).
- `restartContract` refuses only when `meta.upgradability` is set to something
  other than `canUpgrade` (480-481). A contract with no `meta` is restarted, and
  loses its heap state and non-durable facets. An earlier baseline note said
  such a contract "cannot be upgraded"; that was corrected on 2026-09-17.

## What liveslots checks

`packages/swingset-liveslots/src/virtualObjectManager.js` compares the new
`stateShape` with the recorded one field by field and fails with
`durable Kind stateShape mismatch (…)` (lines 270-300).
`packages/swingset-liveslots/src/collectionManager.js` refuses non-durable
values in durable stores with `value is not durable: …` (line 61).

## Sharp edge 9: decided 2026-09-17

The devnet note (FiDeal to FiDeal7, Session 69) reports that adding a method to
a `zone.exo` public facet and redeploying under the same label changed nothing,
and that a fresh label was needed. The project session's correctness pass
decided that `vat-upgrade.md:62` is the rule: redefine every durable kind with
the same facets and methods or a superset, never a subset. The fresh-label
advice is withdrawn. The observation is kept as catalogue entry
`EXO_METHOD_ADDED_NO_EFFECT` (silent, unverified) and will be tested by the
week 2 upgrade task; the report does not say whether the redeploy was an
upgrade or a new instance.
