
# Testing contracts

**Baseline finding.** In the Release 1 baseline both agents shipped green test
suites that did not test the contract a chain would run. Codex drove its
orchestration flow through a hand-built fake orchestrator; Claude hand-ported
the SDK's test tools into its project; Codex's Zoe tests installed the contract
without bundling it (`aagentic-tooling/docs/notes/baseline-2026-09/README.md`). All of it
passed. The idioms below exist so a passing test means something: run under
SES, bundle the real contract, use the SDK's own fakes, and drive the IBC
events that decide success and refund.

Working examples: `aagentic-tooling/packages/skills/snippets/test/`, which runs every snippet
in CI this way.

## Idioms

### Run every test under SES through the Zoe test environment

Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js`, first. It locks
down, provides `VatData` and is `@endo/ses-ava`'s `wrapTest`, so errors keep
their SES details. Plain ava with lockdown loaded some other way passes under
conditions the chain never provides.

**Correct:** `aagentic-tooling/packages/skills/snippets/test/zoe-offer-up.test.js#L4`

```js wrong=TEST_RAW_AVA
import test from 'ava'; // with "require": ["@agoric/zoe/tools/prepare-test-env-ava.js"]
```

**Produces:** silent. Lockdown runs; the test function is not wrapped, and SES error details are lost.

```js wrong=VATDATA_UNAVAILABLE
import '@endo/init/debug.js';
import test from 'ava';
import { setUpZoeForTest } from '@agoric/zoe/tools/setup-zoe.js';
```

**Produces:** `VatData unavailable`

```js wrong=ENDO_ERRORS_BEFORE_SES
import { Fail } from '@endo/errors';
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
```

**Produces:** `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'`

### Bundle the contract from its path

`setUpZoeForTest()` returns `bundleAndInstall`. Give it the contract's file
path, so the contract is bundled with `@endo/bundle-source` and evaluated in a
compartment as on chain. Given an imported module namespace it skips both.
That is acceptable only where a separate bundle check runs: the SDK's own
example tests use the module form because the SDK's CI bundles contracts
elsewhere. A fresh dapp has no such check.

**Correct:** `aagentic-tooling/packages/skills/snippets/test/support.js#L21-L25`

```js wrong=TEST_BUNDLE_BYPASS
import * as contract from '../src/shop.contract.js';
const installation = await bundleAndInstall(contract);
```

**Produces:** silent. A contract that cannot bundle still passes.

### Use the published orchestration test tools, with the loader

`setupOrchestrationTest` from `@agoric/orchestration/tools/contract-tests.ts`
wires the real localchain, transfer middleware, ICA service and bridges with
fakes underneath. It ships as TypeScript: run ava with
`--loader=ts-blank-space/register` and `ts-blank-space` 0.6.2 as a
devDependency (details in `references/orchestration-test-loader.md`). Do not
copy the tools into the project.

**Correct:** `aagentic-tooling/packages/skills/snippets/package.json#L36-L39` `aagentic-tooling/packages/skills/snippets/test/loader.test.js`

```js wrong=TEST_TOOLS_REIMPLEMENTED
// test/tools/setup.js: "a trimmed JS port of contract-tests.ts"
import { setupOrchestrationTest } from './tools/setup.js';
```

**Produces:** silent. Tests pass against a copy that drifts from the SDK.

```js wrong=ORCH_TEST_TOOLS_TS
// no nodeArguments in the ava config
import { setupOrchestrationTest } from '@agoric/orchestration/tools/contract-tests.ts';
```

**Produces:** `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING: Stripping types is currently unsupported for files under node_modules`

### Register the assets the published setup leaves out

At 0.3.0-u23.1 `setupOrchestrationTest` creates the fake bank and the
`vbankAsset` name space but registers no assets, and its `commonPrivateArgs`
carry no `assetInfo`. Add them with published calls: `addAsset` on
`bootstrap.bankManager`, `update` on the `vbankAsset` admin, and `assetOn` for
`assetInfo`. Its `chainInfo` has no cosmoshub; pass
`withChainCapabilities(fetchedChainInfo)` when a test needs it. Local account
addresses come from `makeTestAddress`, so read them from results.

**Correct:** `aagentic-tooling/packages/skills/snippets/test/support.js#L39-L74`

```js wrong=CHAINHUB_DENOM_UNREGISTERED
const { commonPrivateArgs } = await setupOrchestrationTest({ log: t.log });
await E(zoe).startInstance(installation, { Stable: ist.issuer }, {}, commonPrivateArgs);
// then an offer that transfers IST
```

**Produces:** `no denom detail for: "uist" on "agoric". ensure it is registered in chainHub.`

### Decide success and refund with IBC events

A transfer is not done until its packet is acknowledged. After the offer,
send the outcome through the bridge with `utils.transmitVTransferEvent`:
`'acknowledgementPacket'`, the same with an error string, or
`'timeoutPacket'`. Then assert on the offer result (unwrap vows with
`vowTools.when`) and on the payout. The error and timeout cases are what prove a
refund path.

**Correct:** `aagentic-tooling/packages/skills/snippets/test/orchestration-send-anywhere.test.js#L46-L68`

```js wrong=TEST_HAND_MOCKED_ORCHESTRATOR
const account = Far('Local account', {
  transfer: () => asVow(async () => { await gate.promise; }),
});
gate.reject(Error('IBC timeout')); // "the timeout test"
```

**Produces:** silent. The flow, ChainHub and the real account exos never run.

## Negative example: the Servandum suites

The Servandum escrow contracts (`aagentic-tooling/docs/context/agoric-devnet-sharp-edges.md`,
"Testing note") had about 4,200 lines of tests that called flow functions
directly with hand-mocked `zcf`, seats, orchestrator and timer, under
`@endo/init` but without `setUpZoeForTest` or the orchestration test tools.
They passed. On devnet, every fund movement failed until the `E()` in the flows
was removed (sharp edge 1), a failure those tests could not show, because
calling a flow function directly skips the replay membrane that rejects it. Codex's task 4 baseline suite is the
same design at a smaller scale. When a test needs a fake chain, it is the
SDK's fake, underneath the real contract.

## Import order

Keep the environment import first and use static imports. Loading modules
with top-level `await import()` after it (`TEST_IMPORT_WORKAROUND`) was a
workaround for Plug'n'Play in the baseline and is not needed with the
node-modules linker.

---

*Reference: `references/orchestration-test-loader.md`*

# Loading the orchestration test tools

`@agoric/orchestration@0.3.0-u23.1` publishes `tools/contract-tests.ts`
(`setupOrchestrationTest`), `tools/ibc-mocks.ts` and `tools/network-fakes.ts` as
TypeScript source with `.d.ts` files and no compiled JavaScript.
`contract-tests.ts` imports its siblings by `.js` specifiers that do not exist
on disk.

What happens without a loader, on Node 22.23.2 and 24.19.0:

```text
ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING: Stripping types is currently unsupported for files under node_modules
```

What the SDK does ([`agoric-sdk@cc25a29:packages/orchestration/package.json#L87-L103`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/package.json#L87-L103), abridged):

```json
"ava": {
  "extensions": { "js": true, "ts": "module" },
  "nodeArguments": ["--loader=ts-blank-space/register", "--no-warnings"],
  "require": ["@endo/init/debug.js"]
}
```

The same `nodeArguments` in a project outside the SDK let
`setupOrchestrationTest` import and run under `@endo/ses-ava`
(`aagentic-tooling/docs/notes/baseline-2026-09/README.md`, D4 loader check).

## Version

The orchestration package declares `ts-blank-space ^0.6.2`, but as a
devDependency, so a consumer does not get it. The first check happened to run
on 0.4.4, hoisted from `@endo/bundle-source@4.1.2`. Declare 0.6.2 yourself.
Verified with 0.6.2 on Node 22 and 24 on 2026-09-17: the snippet corpus runs
this way (`aagentic-tooling/packages/skills/snippets/package.json`), and
`aagentic-tooling/packages/skills/snippets/test/loader.test.js` checks which copy the loader
resolves to, because `--loader` resolves from the working directory and
bundle-source keeps its own 0.4.4.

## What the published setup does not do

`setupOrchestrationTest` registers no assets and passes no `assetInfo`, its
`chainInfo` has no cosmoshub, and local account addresses come from
`makeTestAddress`. `aagentic-tooling/packages/skills/snippets/test/support.js` shows the
registration with published calls.
