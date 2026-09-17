---
name: agoric-hardened-js
description: "Hardened JavaScript rules for Agoric contract code and the project setup it needs. Load when writing or reviewing any contract, flow or exo module, when an error mentions harden, non-frozen objects, Remotables, Must be, lockdown or secure mode, or when setting up a package that bundles or tests a contract (yarn linker, dependencies, @endo pins, the orchestration test loader). Do not load for deploy commands, Zoe offer design or durable upgrade rules alone; those have their own agoric- skills."
display-name: "Agoric Hardened JS"
short-description: "Hardened JavaScript rules for contract code"
when: "writing or reviewing any contract, flow or exo module"
---

# Hardened JavaScript for Agoric contracts

Contracts run in a SES compartment under `lockdown()`. Code that works in plain
Node can fail there, or pass tests that the chain never runs. Items marked
*Endo idiom* are not Agoric-specific.

Pins: `@agoric/*` at the `agoric-upgrade-23` dist-tag, Endo at the u23 tree,
exact versions (`docs/PINS.md`).

## Idioms

### Harden what crosses a boundary

*Endo idiom.* Everything a function hands to another vat, to marshal, to a
store or to a caller outside the module must be hardened: return values, offer
results, records put into stores, patterns, `meta`. `harden` freezes the whole
reachable graph, so harden once at the point of return.

**Correct:** `examples/offer-up/src/offer-up.contract.js#L173` `examples/send-anywhere/src/send-anywhere.contract.js#L35-L41`

```js wrong=PASS_STYLE_NOT_FROZEN
getPrice() {
  return { brand, value: 10n }; // not hardened
},
```

**Produces:** `Cannot pass non-frozen objects like {"brand":…,"value":"[10n]"}. Use harden()`

### Remotables carry methods only

*Endo idiom.* `Far(label, methods)` makes a remotable whose properties are all
functions. Data goes behind a method or into a copyRecord. A `Far` object is
not durable and has no interface guard; for facets that must survive upgrade or
validate arguments use `zone.exo` with `M.interface` (see
`agoric-durable-state`). The first ref below is the dapp-offer-up template's
`Far` public facet: it shows the methods-only shape, not the idiom to copy for
a contract that will be deployed and kept; the second is.

**Correct:** `examples/offer-up/src/offer-up.contract.js#L170-L172` `examples/send-anywhere/src/send-anywhere.contract.js#L124-L140`

```js wrong=FAR_NON_METHOD
const publicFacet = Far('Shop', { price, getPrice: () => price });
```

**Produces:** `cannot serialize Remotables with non-methods like "price" in {…}`

### No ambient time, randomness, network or filesystem

*Endo idiom.* Contract execution is replayed and must be deterministic. In a
compartment `Date.now()` and `Math.random()` throw, and `fetch`, `process` and
`require` do not exist. Time comes from the timer service passed in
`privateArgs`; randomness has no safe source and must be designed out.

**Correct:** `agoric-sdk@cc25a29:packages/zoe/src/contracts/priceAggregator.js#L157`

```js wrong=SES_TAMED_DATE_RANDOM
const deadline = Date.now() + 60_000;
```

**Produces:** `secure mode Calling %SharedDate%.now() throws` (and `secure mode %SharedMath%.random() throws` for `Math.random()`)

### `E()` for remote objects, never inside an orchestration flow

*Endo idiom*, with one Agoric exception. Use `E(x).method()` to call anything
that may live in another vat: Zoe, storage nodes, the timer, issuers. Inside an
orchestration flow (`*.flows.js`) call account and chain methods directly and
`await` them; `E()` there fails the flow (see `agoric-orchestration`).

**Correct:** `examples/send-anywhere/src/send-anywhere.contract.js#L69-L71` `examples/send-anywhere/src/send-anywhere.flows.js#L122-L131`

```js wrong=E_IN_FLOW
// in a flow
await E(localAccount).transfer(dest, { denom, value });
```

**Produces:** an offer that never settles; the panic `guest eventual applyMethod not yet supported: …` is in the vat log.

### Check untrusted input with patterns

*Endo idiom.* Validate `offerArgs`, terms and method arguments with `@endo/patterns`
(`mustMatch`, `M.splitRecord`, interface guards) at the point they enter.
Failures name the label and the path to the bad value.

**Correct:** `examples/send-anywhere/src/send-anywhere.flows.js#L79`

```js wrong=PATTERN_MISMATCH
mustMatch(offerArgs, harden({ chainName: M.string() }), 'offerArgs');
// called with offerArgs = { chainName: 42 }
```

**Produces:** `offerArgs: chainName: number 42 - Must be a string`

## Project setup

Moved on day 3: bundling setup (yarn linker, declared dependencies, Endo pins) is in `agoric-deploy`; test setup (the SES test environment, the orchestration test loader) is in `agoric-testing`.
