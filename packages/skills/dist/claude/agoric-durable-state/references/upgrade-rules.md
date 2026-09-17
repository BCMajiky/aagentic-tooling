# Upgrade rules, with sources

All citations are agoric-sdk at cc25a29 (tag `agoric-upgrade-23a`).

## What survives an upgrade

`packages/SwingSet/docs/vat-upgrade.md`, "The Upgrade Sequence": non-durable
exported objects are abandoned, and the new code must re-define every durable
kind the old code created "with the same facets and methods or a superset
thereof" (line 62).

## What Zoe checks

`packages/zoe/src/contractFacet/zcfZygote.js`:

- A module that exports `prepare` is treated as `upgradability: 'canUpgrade'`;
  exporting both `start` and `prepare` fails, and so does `prepare` together
  with `meta.upgradability` (lines 268-287).
- With `canUpgrade` or `canBeUpgraded`, the facets and invitation `start`
  returns must be durable, or start fails with
  `with <upgradability>, values from start() must be durable` (300-302,
  452-461). Durable facets are saved to baggage (463-467).
- `restartContract` refuses only when `meta.upgradability` is set to something
  other than `canUpgrade` (480-481). A contract with no `meta` is restarted, and
  loses its heap state and non-durable facets. An earlier baseline note said
  such a contract "cannot be upgraded"; that was corrected on 2026-09-17.

## What liveslots checks

`packages/swingset-liveslots/src/virtualObjectManager.js` compares the new
`stateShape` with the recorded one field by field and fails with
`durable Kind stateShape mismatch (…)` (lines 270-300).
`packages/swingset-liveslots/src/collectionManager.js` refuses non-durable
values in durable stores with `value is not durable: …` (line 61).

## Sharp edge 9: decided 2026-09-17

The devnet note (FiDeal to FiDeal7, Session 69) reports that adding a method to
a `zone.exo` public facet and redeploying under the same label changed nothing,
and that a fresh label was needed. The project session's correctness pass
decided that `vat-upgrade.md:62` is the rule: redefine every durable kind with
the same facets and methods or a superset, never a subset. The fresh-label
advice is withdrawn. The observation is kept as catalogue entry
`EXO_METHOD_ADDED_NO_EFFECT` (silent, unverified) and will be tested by the
week 2 upgrade task; the report does not say whether the redeploy was an
upgrade or a new instance.
