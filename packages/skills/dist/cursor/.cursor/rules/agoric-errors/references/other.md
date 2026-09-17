# Other: error catalogue

### SES_HARNESS_ENDOWMENTS

**Match:** silent

**Cause:** A contract fails under a local SES harness but runs on chain, because the harness endowed less than SwingSet gives a vat (for example no `assert`).

**Fix:** Endow exactly what SwingSet endows: `console`, `assert`, `TextEncoder`, `TextDecoder`, `URL`. The harness is wrong, not the contract.

**See:** `aagentic-tooling/scripts/ses-smoke.mjs`
