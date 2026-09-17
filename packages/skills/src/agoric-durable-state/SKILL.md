---
name: agoric-durable-state
description: "Durable state and upgrade safety for Agoric contracts. Load when a contract must survive upgrade, when using baggage, zones, zone.exo, exoClass, exoClassKit, makeOnce or durable stores, when planning an upgrade, or when an error mentions durable, stateShape or values from start(). Do not load for a throwaway test contract or for offer design alone (agoric-zoe-contract)."
---

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

**Correct:** `agoric-sdk@cc25a29:packages/zoe/src/contracts/valueVow.contract.js#L9-L37`

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

**Correct:** `examples/send-anywhere/src/send-anywhere.contract.js#L124-L140` `agoric-sdk@cc25a29:packages/orchestration/src/examples/staking-combinations.contract.js#L64-L71`

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

**Correct:** `examples/send-anywhere/src/send-anywhere.contract.js#L104-L109`

```js wrong=MAKEONCE_MISSING
const sharedLocalAccountP = makeLocalAccount(); // a new account every incarnation
```

**Produces:** silent. Each upgrade makes a new account; funds in the old one are orphaned.

### Keep durable stores to durable values, with shapes

Make stores from the zone (`zone.mapStore`, `zone.setStore`) with `keyShape`
and `valueShape`. They accept passable data and durable objects: zone exos,
other durable stores, vows. A `Far` object, a closure or a promise is refused.

**Correct:** `agoric-sdk@cc25a29:packages/orchestration/src/exos/chain-hub.js#L275-L298`

```js wrong=DURABLE_VALUE_NOT_DURABLE
const offers = zone.mapStore('offers');
offers.init(id, Far('Receipt', { getId: () => id }));
```

**Produces:** `value is not durable: … at slot 0 of …`

### Upgrade by redefining every kind compatibly

The new code must redefine every durable kind the old code created, with the
same facets and methods or a superset, and a `stateShape` compatible with the
recorded one. Add state fields only as optional and migrate lazily. More
detail and one open conflict in `references/upgrade-rules.md`.

**Correct:** `agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`

```js wrong=DURABLE_STATESHAPE_MISMATCH
// v1: stateShape { price: AmountShape }
// v2:
zone.exoClass('Listing', ListingI, init, methods, {
  stateShape: { price: M.nat() },
});
```

**Produces:** `durable Kind stateShape mismatch (…)`

## Devnet reports not yet checked against u23a

From `docs/context/agoric-devnet-sharp-edges.md`; entered in the catalogue on
day 4.

- **Sharp edge 9, exo interfaces freeze on first creation.** The devnet report
  says a method added to an exo under the same label does nothing after
  redeploy, and recommends a fresh label. That conflicts with
  `vat-upgrade.md` at u23a, which allows a superset of methods on upgrade.
  Both may be true of different operations (a new instance with the same label
  versus an upgrade); see `references/upgrade-rules.md`. Until that is settled,
  do not rely on either.
- **Sharp edge 10, prefix ids on redeploy.** A fresh instance restarts its
  counters, so vstorage records written as `…-1` overwrite the previous
  deployment's. Carry an id prefix term (`v2-1`) and treat the on-chain terms as
  the truth.
