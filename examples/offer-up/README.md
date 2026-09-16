# examples/offer-up

The Offer Up tutorial contract: mints semi-fungible Item NFTs and sells up to
`maxItems` of them at a fixed `tradePrice`.

**Source:** [Agoric/dapp-offer-up](https://github.com/Agoric/dapp-offer-up) at
commit `4ea27c5`, `contract/src/offer-up.contract.js`.
**Checked against:** `@agoric/zoe@0.28.0-u23.1` (tag `agoric-upgrade-23a`).

## Why it is here

Two jobs:

1. It is a **SES smoke subject**. `yarn smoke` bundles it with
   `@endo/bundle-source` and evaluates it under `lockdown()`, which is the seed
   of Preflight's own test suite.
2. It is a **format B subject**, and the interesting one. Its public facet is a
   bare `Far('Items Public Facet', ...)` with no `M.interface` guard, so its
   manifest carries `facets.public.guard: "none"`. A manifest format that
   cannot describe this contract cannot describe most contracts in the wild.

## Do not improve it

It is meant to be `@agoric` API-exact. Three changes were needed to run under
upgrade-23 and nothing else has been touched:

| Change | Why |
|---|---|
| `import '@agoric/zoe/exported.js'` deleted | That module does not exist anywhere in agoric-sdk at `agoric-upgrade-23a`. It is a hard module-resolution failure at bundle time, not a deprecation. |
| `ZCF` and `OfferHandler` imported from `@agoric/zoe` | They were ambient globals supplied by `exported.js`. This is how the SDK writes them at u23. |
| `@import {Amount}` from `@agoric/ertp` instead of `@agoric/ertp/src/types.js` | That deep path is `types.ts` now and no longer resolves. Type-check only. |

Deliberately **not** changed: `atomicRearrange(zcf, ...)` is `@deprecated` at u23
in favour of the `zcf.atomicRearrange` builtin, but the helper still exists and
still works. Changing it would be an improvement, which is exactly what is out
of scope. The upstream pin is two release lines behind (u16), so this is worth
re-checking whenever the pin moves.

## Rules

No `Date.now()`, no `Math.random()`, no network, no filesystem. The SES smoke
job exists to catch that; let it.
