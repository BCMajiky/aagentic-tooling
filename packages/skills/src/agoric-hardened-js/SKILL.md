---
name: agoric-hardened-js
description: "Hardened JavaScript rules for Agoric contract code and the project setup it needs. Load when writing or reviewing any contract, flow or exo module, when an error mentions harden, non-frozen objects, Remotables, Must be, lockdown or secure mode, or when setting up a package that bundles or tests a contract (yarn linker, dependencies, @endo pins, the orchestration test loader). Do not load for deploy commands, Zoe offer design or durable upgrade rules alone; those have their own agoric- skills."
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
`agoric-durable-state`).

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

**Produces:** `guest eventual applyMethod not yet supported: …`, recorded on the flow; the offerer sees a hang, not an error.

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

These come from the Release 1 baseline, where both agents hit them before
writing any contract logic. They may move to `agoric-deploy` on day 3 if that
reads better.

### Use the node-modules linker

Yarn 4 defaults to Plug'n'Play. SES tooling and the Zoe test tools need real
files in `node_modules`, so a fresh project needs a `.yarnrc.yml`.

**Correct:** `.yarnrc.yml#L1-L3`

```yaml wrong=YARN_PNP_DEFAULT
# .yarnrc.yml absent, or:
nodeLinker: pnp
```

**Produces:** `EROFS: read-only filesystem, mkdir '/node_modules/bundles'` from the Zoe test tools, or `Your application tried to access @endo/errors, but it isn't declared in your dependencies`

### Declare every package the contract imports

`@endo/bundle-source` follows declared dependencies only. `@endo/patterns`,
`@endo/errors` and `@endo/far` resolve in Node because the SDK hoists them,
and are still missing from the bundle unless the contract's own `package.json`
lists them, at the versions in `resolutions`.

**Correct:** `examples/send-anywhere/package.json#L15-L24`

```json wrong=BUNDLE_UNDECLARED_DEP
"dependencies": {
  "@agoric/orchestration": "0.3.0-u23.1",
  "@agoric/zoe": "0.28.0-u23.1"
}
```

**Produces:** `Cannot find external module "@endo/patterns" in package file:///…/`

### Pin the whole Endo tree

Top-level pins are not enough: a floating `@endo/*` range pulls in a second
`ses`, and two lockdown shims collide. Copy the `resolutions` block that
matches the SDK's lockfile.

**Correct:** `package.json#L49-L83` `docs/PINS.md`

```json wrong=ENDO_MULTIPLE_SES
"devDependencies": { "@endo/ses-ava": "^1.3.2", "ses": "1.14.0" }
```

**Produces:** `TypeError: Cannot redefine property: sliceToImmutable`

### Load the SES environment first in tests

Tests import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js`, which
locks down, provides `VatData` and wraps ava with `@endo/ses-ava`. It must be
the first import.

**Correct:** `agoric-sdk@cc25a29:packages/SwingSet/tools/prepare-test-env-ava.js`

```js wrong=ENDO_ERRORS_BEFORE_SES
import { Fail } from '@endo/errors';
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
```

**Produces:** `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'`

### Load the orchestration test tools through ts-blank-space

`@agoric/orchestration/tools/contract-tests.ts` and its siblings ship as
TypeScript, Node will not strip types under `node_modules`, and the package does
not install a loader for you. Add `ts-blank-space` as a devDependency and pass
the loader to ava, as the SDK does. Details and the unverified version pin are
in `references/orchestration-test-loader.md`.

**Correct:** `agoric-sdk@cc25a29:packages/orchestration/package.json#L95-L98`

```json wrong=ORCH_TEST_TOOLS_TS
"ava": { "files": ["test/**/*.test.js"] }
// test imports '@agoric/orchestration/tools/contract-tests.ts'
```

**Produces:** `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING: Stripping types is currently unsupported for files under node_modules`
