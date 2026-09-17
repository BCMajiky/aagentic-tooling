# Other: error catalogue

### SES_HARNESS_ENDOWMENTS

**Match:** silent

**Cause:** A contract fails under a local SES harness but runs on chain, because the harness endowed less than SwingSet gives a vat (for example no `assert`).

**Fix:** Endow what SwingSet endows: `console`, `assert`, `TextEncoder`, `TextDecoder` and `URL`, as `scripts/ses-smoke.mjs` does (line 120 for `URL`). The harness is wrong, not the contract. At u23a SwingSet marks `URL` "Unavailable only on XSnap" and `Base64` "Available only on XSnap", and chain vats run under XSnap, so a contract must not rely on `URL`.

**See:** `aagentic-tooling/scripts/ses-smoke.mjs#L114-L122` · [`agoric-sdk@cc25a29:packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/src/kernel/vat-loader/manager-local.js#L74-L83)
