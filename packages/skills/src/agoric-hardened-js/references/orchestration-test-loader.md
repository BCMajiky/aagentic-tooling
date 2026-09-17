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

What the SDK does (`agoric-sdk@cc25a29:packages/orchestration/package.json#L87-L103`, abridged):

```json
"ava": {
  "extensions": { "js": true, "ts": "module" },
  "nodeArguments": ["--loader=ts-blank-space/register", "--no-warnings"],
  "require": ["@endo/init/debug.js"]
}
```

The same `nodeArguments` in a project outside the SDK let
`setupOrchestrationTest` import and run under `@endo/ses-ava`
(`docs/notes/baseline-2026-09/README.md`, D4 loader check).

## Version

The orchestration package declares `ts-blank-space ^0.6.2`, but as a
devDependency, so a consumer does not get it. The first check happened to run
on 0.4.4, hoisted from `@endo/bundle-source@4.1.2`. Declare 0.6.2 yourself.
Verified with 0.6.2 on Node 22 and 24 on 2026-09-17: the snippet corpus runs
this way (`packages/skills/snippets/package.json`), and
`packages/skills/snippets/test/loader.test.js` checks which copy the loader
resolves to, because `--loader` resolves from the working directory and
bundle-source keeps its own 0.4.4.

## What the published setup does not do

`setupOrchestrationTest` registers no assets and passes no `assetInfo`, its
`chainInfo` has no cosmoshub, and local account addresses come from
`makeTestAddress`. `packages/skills/snippets/test/support.js` shows the
registration with published calls.
