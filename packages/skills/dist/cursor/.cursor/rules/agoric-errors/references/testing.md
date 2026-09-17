# Testing: error catalogue

### TEST_BUNDLE_BYPASS

**Match:** silent

**Cause:** `bundleAndInstall(moduleNamespace)` with an imported module instead of a path goes through `bundleTestExports`: the contract is never bundled or evaluated in a compartment, so a contract that cannot bundle still passes. Severity low. It is acceptable only where a separate bundle check runs, as the SDK's CI does; a fresh dapp has no such check.

**Fix:** Unless the project has its own bundle check, pass a file path: `bundleAndInstall(new URL("../src/x.contract.js", import.meta.url).pathname)`, or bundle with `@endo/bundle-source` and `E(zoe).install(bundle)`.

**See:** [`agoric-sdk@cc25a29:packages/zoe/tools/setup-zoe.js#L69-L84`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/tools/setup-zoe.js#L69-L84) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_IMPORT_WORKAROUND

**Match:** silent

**Cause:** Test modules loaded through top-level `await import()` after the test-environment import, a workaround for ENDO_ERRORS_BEFORE_SES that is unnecessary once the environment import is first and the workspace uses the node-modules linker.

**Fix:** Import `@agoric/zoe/tools/prepare-test-env-ava.js` first, then use ordinary static imports.

**See:** `ENDO_ERRORS_BEFORE_SES` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_TOOLS_REIMPLEMENTED

**Match:** silent

**Cause:** The orchestration test tools (`setupOrchestrationTest`, network fakes, IBC mocks) were hand-ported into the project instead of imported, because they ship as TypeScript. The port drifts from upstream on every SDK bump.

**Fix:** Import them from `@agoric/orchestration/tools/*.ts` with the `ts-blank-space` loader (see ORCH_TEST_TOOLS_TS).

**See:** `ORCH_TEST_TOOLS_TS` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### TEST_HAND_MOCKED_ORCHESTRATOR

**Match:** silent

**Cause:** Tests drive the flow through a hand-built orchestrator with `Far` fakes, bypassing `withOrchestration`, ChainHub, the real account exos and the IBC mocks. Everything passes under conditions no chain provides. The Servandum suites are the same mistake.

**Fix:** Start the real contract with `setupOrchestrationTest` from `@agoric/orchestration/tools/contract-tests.ts` and drive acknowledgements and timeouts with its `transmitVTransferEvent`.

**See:** skill `agoric-testing` · [`agoric-sdk@cc25a29:packages/orchestration/tools/contract-tests.ts`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/tools/contract-tests.ts) · `aagentic-tooling/docs/context/agoric-devnet-sharp-edges.md` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### TEST_RAW_AVA

**Match:** silent

**Cause:** A test file uses ava's own `test` (`import test from 'ava'`) with the SES environment loaded through ava's `require`. Lockdown runs, but the test function is not wrapped by `@endo/ses-ava`, so SES error reporting is lost.

**Fix:** Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js`, which is `wrapTest` from `@endo/ses-ava`.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/tools/prepare-test-env-ava.js`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/tools/prepare-test-env-ava.js) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### ENDO_ERRORS_BEFORE_SES

**Match:** contains `Cannot initialize @endo/errors, missing globalThis.assert, import 'ses' before '@endo/errors'`

**Cause:** A module that uses `@endo/errors` was evaluated before lockdown installed `assert`.

**Fix:** Make the SES environment the first import (in tests, `@agoric/zoe/tools/prepare-test-env-ava.js`; in scripts, `@endo/init`).

**See:** skill `agoric-testing` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### VATDATA_UNAVAILABLE

**Match:** contains `VatData unavailable`

**Cause:** Zoe or durable-state code ran under plain lockdown without the SwingSet test environment, which provides `VatData`.

**Fix:** Import `test` from `@agoric/zoe/tools/prepare-test-env-ava.js` rather than setting up `@endo/init` yourself.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/tools/prepare-test-env-ava.js`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/tools/prepare-test-env-ava.js) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md` · skill `agoric-testing`

### ORCH_TEST_TOOLS_TS

**Match:** contains `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`

**Cause:** `@agoric/orchestration/tools/*.ts` ship as TypeScript. Node refuses to strip types under `node_modules`, and the package lists `ts-blank-space` only as a devDependency, so consumers do not get the loader.

**Fix:** Add `ts-blank-space` (0.6.2, matching the package's `^0.6.2`) as a devDependency and run ava with `nodeArguments: ['--loader=ts-blank-space/register', '--no-warnings']`. Verified with 0.6.2 on Node 22 and 24 by `packages/skills/snippets/test/loader.test.js`.

**See:** skill `agoric-testing` · [`agoric-sdk@cc25a29:packages/orchestration/package.json#L95-L98`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/package.json#L95-L98) · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### CHAINHUB_DENOM_UNREGISTERED

**Match:** contains `ensure it is registered in chainHub`

**Cause:** An orchestration flow looked up a denom or brand ChainHub does not know. In tests, the usual cause is that `setupOrchestrationTest`'s `commonPrivateArgs` carry no `assetInfo`; on chain, that the contract was started without the asset's `assetInfo`.

**Fix:** Pass `assetInfo` built with `assetOn(denom, chainName, brand)` in privateArgs, so `registerChainsAndAssets` registers it; in tests also register the asset in the fake bank and `vbankAsset`.

**See:** `aagentic-tooling/packages/skills/snippets/test/support.js#L39-L74` · skill `agoric-testing`
