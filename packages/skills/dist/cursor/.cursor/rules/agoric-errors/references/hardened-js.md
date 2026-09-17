# Hardened JavaScript: error catalogue

### PASS_STYLE_NOT_FROZEN

**Match:** contains `Cannot pass non-frozen objects like`

**Cause:** An object crossing a vat or marshal boundary (method result, offer result, stored value, argument) was not hardened.

**Fix:** Call `harden()` on the value before it leaves the function.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L173` · skill `agoric-hardened-js`

### FAR_NON_METHOD

**Match:** contains `cannot serialize Remotables with non-methods like`

**Cause:** A `Far` object carries a property that is not a function.

**Fix:** Keep data out of remotables. Expose it through a method (`getPrice: () => price`) or return a copyRecord.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L170-L172` · skill `agoric-hardened-js`

### PATTERN_MISMATCH

**Match:** matches ` - Must (be|have|not|fail|match)`

**Cause:** A value did not match the `@endo/patterns` shape passed to `mustMatch`, an interface guard, `customTermsShape` or a store `valueShape`. The label before the first colon says which check failed.

**Fix:** Read the path in the message (for example `offerArgs: chainName: number 42 - Must be a string`) and fix the value or the pattern.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.flows.js#L79` · skill `agoric-hardened-js`

### SES_TAMED_DATE_RANDOM

**Match:** matches `secure mode Calling %SharedDate%\.now\(\) throws|secure mode %SharedMath%\.random\(\) throws`

**Cause:** Contract code called `Date.now()` or `Math.random()`. Under lockdown in a compartment both throw, because contract execution must be deterministic.

**Fix:** Take time from the timer service (`E(timer).getCurrentTimestamp()`) passed in `privateArgs`. Take randomness from nowhere: design it out.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contracts/priceAggregator.js#L157`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contracts/priceAggregator.js#L157) · `aagentic-tooling/scripts/ses-smoke.mjs` · skill `agoric-hardened-js`
