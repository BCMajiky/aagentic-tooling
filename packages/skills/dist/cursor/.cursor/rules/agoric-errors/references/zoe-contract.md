# Zoe contracts: error catalogue

### CUSTOM_TERMS_SHAPE_LOCATION

**Match:** silent

**Cause:** A `customTermsShape` placed anywhere other than the exported `meta` is ignored, so terms are never validated. At u23 ZCF reads it from `meta` only, and checks it lazily inside `zcf.getTerms()`.

**Fix:** Export `meta = harden({ customTermsShape })` from the contract module. A bad term then fails `zcf.getTerms()` with `customTerms: … - Must be …`. For a shape that is missing altogether, see CUSTOM_TERMS_SHAPE_MISSING.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L88-L94` · [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L358-L368`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L358-L368) · `CUSTOM_TERMS_SHAPE_MISSING` · skill `agoric-zoe-contract`

### CUSTOM_TERMS_SHAPE_MISSING

**Match:** silent

**Cause:** The contract exports no `meta.customTermsShape` and checks terms by hand, or not at all. Malformed terms are accepted at `startInstance`.

**Fix:** Export `meta = harden({ customTermsShape })`. If a shape exists but is not in `meta`, see CUSTOM_TERMS_SHAPE_LOCATION.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L88-L94` · `CUSTOM_TERMS_SHAPE_LOCATION` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PROPOSAL_SHAPE_MISSING

**Match:** silent

**Cause:** `zcf.makeInvitation` is called without a `proposalShape`, so Zoe escrows any proposal and the handler has to refuse bad ones by hand after escrow.

**Fix:** Pass a `proposalShape` as the fourth argument. Zoe checks it before escrow (`zoeService/offer/offer.js`), and a bad offer fails with `"<description>" proposal: … - Must be: …`.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L126-L130` · `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L166-L167` · [`agoric-sdk@cc25a29:packages/zoe/src/zoeService/offer/offer.js#L45-L60`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/zoeService/offer/offer.js#L45-L60) · `PROPOSAL_SHAPE_MISMATCH` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PUBLIC_FACET_AUTHORITY

**Match:** silent

**Cause:** A per-principal or administrative method sits on `publicFacet`, which anyone holding the instance can reach with `E(zoe).getPublicFacet(instance)`.

**Fix:** Put it on `creatorFacet` or on a per-principal facet or continuing invitation. See the POLA section lifted from agoric-sdk in the zoe-contract skill.

**See:** `aagentic-tooling/examples/send-anywhere/src/send-anywhere.contract.js#L66` · skill `agoric-zoe-contract`

### ZOE_EXPORTED_MISSING

**Match:** matches `Cannot find file for internal module "\./exported\.js".*@agoric/zoe/`

**Cause:** `@agoric/zoe/exported.js` does not exist at u23; older tutorials import it for its ambient types. The bundle still builds, so the failure appears when the bundle is evaluated: on chain the install succeeds and `startInstance` fails.

**Fix:** Delete the import. Import `ZCF`, `OfferHandler` and friends as types from `@agoric/zoe` with a JSDoc `@import`.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L57-L60` · `aagentic-tooling/examples/offer-up/README.md` · skill `agoric-zoe-contract`

### ATOMIC_REARRANGE_HELPER

**Match:** matches `import\s*\{[^}]*\batomicRearrange\b[^}]*\}\s*from\s*'@agoric/zoe/src/contractSupport`

**Cause:** The `atomicRearrange(zcf, transfers)` helper from `@agoric/zoe/src/contractSupport` is deprecated at u23 and only forwards to the ZCF method. It works; it is the old idiom. Also a baseline output defect (task 1, Claude).

**Fix:** Call `zcf.atomicRearrange(harden([...transfers]))` and drop the import.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractSupport/atomicTransfer.js#L47-L54`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractSupport/atomicTransfer.js#L47-L54) · [`agoric-sdk@cc25a29:packages/orchestration/src/utils/zoe-tools.js#L81`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/orchestration/src/utils/zoe-tools.js#L81) · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### OFFER_SAFETY_VIOLATION

**Match:** contains `Offer safety was violated by the proposed allocation`

**Cause:** A reallocation would leave a seat with neither what it wanted nor what it gave. Zoe refuses the whole rearrangement.

**Fix:** Move the wanted amount to the seat (mint it, or transfer it from another seat) in the same `zcf.atomicRearrange` that takes its payment.

**See:** `aagentic-tooling/examples/offer-up/src/offer-up.contract.js#L143-L152` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### PROPOSAL_SHAPE_MISMATCH

**Match:** matches `" proposal: .* - Must be`

**Cause:** The offer's proposal does not match the invitation's `proposalShape`. Zoe rejects it before escrow.

**Fix:** Make the offer match the shape, or widen the shape if the contract really accepts that proposal.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/zoeService/offer/offer.js#L45-L49`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/zoeService/offer/offer.js#L45-L49) · `PROPOSAL_SHAPE_MISSING` · skill `agoric-zoe-contract` · `aagentic-tooling/docs/notes/baseline-2026-09/README.md`

### OFFER_HANDLER_UNDEFINED_REASON

**Match:** contains `If an offerHandler throws, it must provide a reason of type Error`

**Cause:** An offer handler threw `undefined` (for example a bare `throw;` or a rejected promise with no reason).

**Fix:** Throw an `Error`: `throw Fail`…`` or `throw makeError(…)`. ZCF fails the seat with it and the offerer gets a full refund.

**See:** [`agoric-sdk@cc25a29:packages/zoe/src/contractFacet/zcfZygote.js#L206-L214`](https://github.com/Agoric/agoric-sdk/blob/agoric-upgrade-23a/packages/zoe/src/contractFacet/zcfZygote.js#L206-L214) · skill `agoric-zoe-contract`
