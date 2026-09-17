# Durable state and upgrade: error catalogue

### CONTRACT_NOT_UPGRADABLE

**Match:** silent

**Cause:** The contract exports `start` returning `Far` facets over closure state, with no `meta.upgradability`, no durable zone and no exos. Zoe does not refuse an upgrade, but non-durable facets are abandoned and closure state is gone, so clients lose their references and funds held in closure seats are unreachable.

**Fix:** Export `meta = harden({ upgradability: 'canUpgrade' })`, take `baggage` as the third `start` argument, build a durable zone with `makeDurableZone(baggage)` and make facets with `zone.exo`.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contracts/valueVow.contract.js#L9-L37`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contracts/valueVow.contract.js#L9-L37) · [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L15`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L15) · skill `agoric-durable-state` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### MAKEONCE_MISSING

**Match:** silent

**Cause:** A long-lived object (an orchestration account, a vow kit, a singleton) is created with a plain call in contract start, so every incarnation creates a new one and the previous one, with anything it holds, is orphaned.

**Fix:** Create it with `zone.makeOnce('name', () => make())`, which runs the maker only on first start and returns the stored value after an upgrade.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L104-L109` · skill `agoric-durable-state`

### DURABLE_KIND_SUBSET

**Match:** silent

**Cause:** An upgrade redefined a durable kind with fewer facets or methods than the previous incarnation. Objects of that kind already held by clients or stored durably keep their identity, and calls to the missing methods fail. Upstream forbids it; the exact error text was not reproduced at u23a.

**Fix:** Redefine every durable kind with the same facets and methods or a superset. Retire a method by keeping it and making it throw a clear error.

**See:** [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L62) · skill `agoric-durable-state`

### EXO_METHOD_ADDED_NO_EFFECT

**Match:** silent

**Cause:** Unverified devnet observation (sharp edge 9): a method added to a `zone.exo` public facet did nothing after redeploying under the same label, and a fresh label was used to get around it. It conflicts with the upstream upgrade rule, which allows a superset of methods, and it is not known whether the redeploy was an upgrade or a new instance. To be tested by the week 2 upgrade task.

**Fix:** Do not rename exo labels on upgrade; follow the upstream rule (same facets and methods or a superset). If a new method seems to have no effect, check whether the contract was upgraded or a new instance was started, and record the case against this entry.

**See:** devnet sharp edge 9 · [`agoric-sdk@cc25a29:packages/SwingSet/docs/vat-upgrade.md#L62`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/SwingSet/docs/vat-upgrade.md#L62) · `DURABLE_KIND_SUBSET` · `aagentic-tooling/packages/skills/src/agoric-durable-state/references/upgrade-rules.md`

### DURABLE_STATESHAPE_MISMATCH

**Match:** contains `durable Kind stateShape mismatch`

**Cause:** An upgrade redefined a durable exo class with a `stateShape` that is not compatible with the one recorded by the previous incarnation.

**Fix:** Keep existing state fields and their shapes. Add new fields only as optional, and migrate lazily.

**See:** [`agoric-sdk@cc25a29:packages/swingset-liveslots/src/virtualObjectManager.js#L270-L300`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-liveslots/src/virtualObjectManager.js#L270-L300) · skill `agoric-durable-state`

### START_VALUES_NOT_DURABLE

**Match:** contains `values from start() must be durable`

**Cause:** A contract declares `meta.upgradability: 'canUpgrade'` but `start` returns a facet that is not durable, typically a `Far` object.

**Fix:** Make every facet `start` returns a `zone.exo` (or another durable object) from a zone built on the baggage.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L452-L461`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L452-L461) · `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L124-L140` · skill `agoric-durable-state`

### DURABLE_VALUE_NOT_DURABLE

**Match:** contains `value is not durable`

**Cause:** A durable store or durable exo state was given a heap object: a `Far` object, a plain closure or a promise.

**Fix:** Store only passable data and durable objects (zone exos, other durable stores, vows). Make the `Far` object a `zone.exo`.

**See:** [`agoric-sdk@cc25a29:packages/swingset-liveslots/src/collectionManager.js#L61`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/swingset-liveslots/src/collectionManager.js#L61) · skill `agoric-durable-state`
