# Other: error catalogue

### SES_HARNESS_ENDOWMENTS

**Match:** silent

**Cause:** A contract fails under a local SES harness but runs on chain, or passes the harness and fails on chain, because the harness endows something different from what SwingSet gives a vat under XSnap: less (for example no `assert`) or more (for example `URL`, which chain vats do not have).

**Fix:** Endow what a vat gets under XSnap: `console`, `assert`, `HandledPromise`, `TextEncoder`, `TextDecoder` and `Base64`, and nothing else, as `scripts/ses-smoke.mjs` does. Node has no `Base64`, so the harness endows it as undefined. `URL` is not a vat global on chain; a contract must not rely on it.

**See:** `aagentic-tooling/scripts/ses-smoke.mjs#L130-L139` · [`agoric-sdk@cc25a29:packages/swingset-xsnap-supervisor/lib/supervisor-subprocess-xsnap.js#L255-L264`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-xsnap-supervisor/lib/supervisor-subprocess-xsnap.js#L255-L264) · [`agoric-sdk@cc25a29:packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83)
