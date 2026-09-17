# Project setup and deploy: error catalogue

### CHAIN_BUNDLE_INSTALL_UNDERGASSED

**Match:** silent

**Cause:** A bundle install was sent with `--gas auto` or a fixed gas below 100000000. The transaction returns success and installs nothing (sharp edges 14 and 15). Reported on devnet; not reproduced here.

**Fix:** Install with `--gas 100000000`, then query the chain for the bundle id before submitting the CoreEval.

**See:** devnet sharp edge 14 · devnet sharp edge 15 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L15-L24` · skill `agoric-deploy`

### WALLET_SPEND_WITHOUT_ALLOW_SPEND

**Match:** silent

**Cause:** A wallet action that gives payments was submitted without `--allow-spend`, so it went as `MsgWalletAction`. The transaction returns code 0, the offer is rejected, nothing moves (sharp edge 17).

**Fix:** Submit fund-moving offers with `agd tx swingset wallet-action --allow-spend`, as the `agoric` CLI does.

**See:** devnet sharp edge 17 · [`agoric-sdk@cc25a29:packages/agoric-cli/src/commands/wallet.js#L180-L182`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/agoric-cli/src/commands/wallet.js#L180-L182) · skill `agoric-deploy`

### BOARD_ID_HARDCODED

**Match:** silent

**Cause:** A client hardcodes a board id or instance handle. Both change on every deploy (sharp edge 18).

**Fix:** Look them up in `published.agoricNames` after each deploy.

**See:** devnet sharp edge 18 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L42-L46` · skill `agoric-deploy`

### PAY_DENOM_HARDCODED

**Match:** silent

**Cause:** Contract or client code hardcodes a pay denom. It differs per network: `ibc/toyusdc` on devnet, the Noble USDC IBC denom on mainnet (sharp edge 19).

**Fix:** Pass the denom as a term or in `assetInfo`; take the network value from `aat config show` or `networks.json` and check `published.agoricNames.vbankAsset`.

**See:** devnet sharp edge 19 · `aagentic-tooling/packages/core/src/networks.json#L30-L40` · skill `agoric-deploy`

### DEVNET_TIMER_WAKEUP_MISSING

**Match:** silent

**Cause:** Unverified devnet observation (sharp edge 22): timer wakeups did not fire on the shared devnet. An infrastructure problem, not a contract bug.

**Fix:** Check timer behaviour on a local chain before debugging contract timer logic against devnet.

**See:** devnet sharp edge 22 · skill `agoric-deploy`

### ENDO_MULTIPLE_SES

**Match:** contains `TypeError: Cannot redefine property: sliceToImmutable`

**Cause:** More than one copy of `ses` is installed because `@endo/*` versions drifted from the SDK tree, so two lockdown shims run.

**Fix:** Pin the whole `@endo/*` tree and `ses` through `resolutions`, copied from the u23 lockfile (`docs/PINS.md`). One line from `find node_modules -type d -path "*node_modules/ses"` means it is fixed.

**See:** `aagentic-tooling/docs/PINS.md` · skill `agoric-deploy`

### YARN_PNP_DEFAULT

**Match:** matches `EROFS: read-only filesystem, mkdir '/node_modules/bundles'|Your application tried to access @endo/\S+, but it isn't declared in your dependencies`

**Cause:** Yarn 4 with no `.yarnrc.yml` installs with Plug'n'Play. The Zoe test tools write bundles to a real `node_modules` path and SES tooling resolves real files, so both fail.

**Fix:** Add `nodeLinker: node-modules` to `.yarnrc.yml` and run `yarn install` again.

**See:** `aagentic-tooling/.yarnrc.yml#L1-L3` · skill `agoric-deploy` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### BUNDLE_UNDECLARED_DEP

**Match:** matches `Cannot find external module "[^"]+" in package`

**Cause:** `@endo/bundle-source` follows only the dependencies a package declares. A package that resolves in Node because it is hoisted into `node_modules` is still missing from the bundle.

**Fix:** Declare every package the contract imports (typically `@endo/patterns`, `@endo/errors`, `@endo/far`) in `dependencies`, at the versions in `resolutions`.

**See:** `aagentic-tooling/examples/send-anywhere/package.json` · skill `agoric-deploy` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### CHAIN_PAYLOAD_TOO_LARGE

**Match:** contains `413 Payload Too Large`

**Cause:** Public RPC rejects request bodies over about 1 MB (CometBFT `max_body_bytes`), which an uncompressed bundle exceeds (sharp edge 16). Reported on devnet; not reproduced here.

**Fix:** Compress the bundle before installing; a contract still over the limit needs the multi-bundle install pattern.

**See:** devnet sharp edge 16 · `aagentic-tooling/docs/context/agoric-deploy-sequence.md#L22` · skill `agoric-deploy`
