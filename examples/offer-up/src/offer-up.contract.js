// SPDX-License-Identifier: Apache-2.0
//
// Copied from Agoric/dapp-offer-up at commit 4ea27c5,
// contract/src/offer-up.contract.js, and checked against
// @agoric/zoe 0.28.0-u23.1.
//
// Three changes were needed to run under upgrade-23, and nothing else has been
// touched. The contract is a format B and SES smoke subject; it is meant to be
// @agoric API-exact, not improved. See docs/formats/contract-manifest.v0.md.
//
//   1. `import '@agoric/zoe/exported.js'` is DELETED. That module no longer
//      exists anywhere in agoric-sdk at agoric-upgrade-23a, so the import is a
//      hard module-resolution failure at bundle time. It was what supplied the
//      ambient ZCF and OfferHandler JSDoc globals, so change 2 replaces them.
//      Correction 2026-09-17: not at bundle time. bundle-source 4.1.2 builds
//      the bundle; evaluating it fails with "Cannot find file for internal
//      module \"./exported.js\"". See docs/context/claude_plan-amendments.md.
//   2. The ambient types it provided are now imported explicitly from
//      '@agoric/zoe', which is how the SDK itself writes them at u23.
//   3. `@import {Amount} from '@agoric/ertp/src/types.js'` becomes
//      '@agoric/ertp': the deep types.js path is now types.ts and no longer
//      resolves. Type-check only; it did not affect execution.
//
// Deliberately NOT changed: `atomicRearrange(zcf, ...)` is marked @deprecated
// at u23 in favour of the `zcf.atomicRearrange` builtin, but the helper still
// exists and still works, so the call stays as the tutorial writes it.

/**
 * @file Contract to mint and sell a few Item NFTs at a time.
 *
 * We declare variables (including functions) before using them,
 * so you may want to skip ahead and come back to some details.
 * @see {start} for the main contract entrypoint
 *
 * As is typical in Zoe contracts, the flow is:
 *   1. contract does internal setup and returns public / creator facets.
 *   2. client uses a public facet method -- {@link makeTradeInvitation} in this case --
 *      to make an invitation.
 *   3. client makes an offer using the invitation, along with
 *      a proposal (with give and want) and payments. Zoe escrows the payments, and then
 *   4. Zoe invokes the offer handler specified in step 2 -- here {@link tradeHandler}.
 *
 * @see {@link https://docs.agoric.com/guides/zoe/|Zoe Overview} for a walk-thru of this contract
 * @see {@link https://docs.agoric.com/guides/js-programming/hardened-js.html|Hardened JavaScript}
 * for background on `harden` and `assert`.
 */
// @ts-check
// @jessie-check

import { Far } from '@endo/far';
import { M, getCopyBagEntries } from '@endo/patterns';
import { AssetKind } from '@agoric/ertp/src/amountMath.js';
import { AmountShape } from '@agoric/ertp/src/typeGuards.js';
import { atomicRearrange } from '@agoric/zoe/src/contractSupport/atomicTransfer.js';

/**
 * @import {Amount} from '@agoric/ertp';
 * @import {CopyBag} from '@endo/patterns';
 * @import {ZCF, OfferHandler} from '@agoric/zoe';
 */
const { Fail, quote: q } = assert;

// #region bag utilities
/** @type { (xs: bigint[]) => bigint } */
const sum = xs => xs.reduce((acc, x) => acc + x, 0n);

/**
 * @param {CopyBag} bag
 * @returns {bigint[]}
 */
const bagCounts = bag => {
  const entries = getCopyBagEntries(bag);
  return entries.map(([_k, ct]) => ct);
};
// #endregion

/**
 * In addition to the standard `issuers` and `brands` terms,
 * this contract is parameterized by terms for price and,
 * optionally, a maximum number of items sold for that price (default: 3).
 *
 * @typedef {{
 *   tradePrice: Amount;
 *   maxItems?: bigint;
 * }} OfferUpTerms
 */

export const meta = {
  customTermsShape: M.splitRecord(
    { tradePrice: AmountShape },
    { maxItems: M.bigint() },
  ),
};
harden(meta);
// compatibility with an earlier contract metadata API
export const customTermsShape = meta.customTermsShape;
harden(customTermsShape);

/**
 * Start a contract that
 *   - creates a new non-fungible asset type for Items, and
 *   - handles offers to buy up to `maxItems` items at a time.
 *
 * @param {ZCF<OfferUpTerms>} zcf
 */
export const start = async zcf => {
  const { tradePrice, maxItems = 3n } = zcf.getTerms();

  /**
   * a new ERTP mint for items, accessed thru the Zoe Contract Facet.
   * Note: `makeZCFMint` makes the associated brand and issuer available
   * in the contract's terms.
   *
   * AssetKind.COPY_BAG can express non-fungible (or rather: semi-fungible)
   * amounts such as: 3 potions and 1 map.
   */
  const itemMint = await zcf.makeZCFMint('Item', AssetKind.COPY_BAG);
  const { brand: itemBrand } = itemMint.getIssuerRecord();

  /**
   * a pattern to constrain proposals given to {@link tradeHandler}
   *
   * The `Price` amount must be >= `tradePrice` term.
   * The `Items` amount must use the `Item` brand and a bag value.
   */
  const proposalShape = harden({
    give: { Price: M.gte(tradePrice) },
    want: { Items: { brand: itemBrand, value: M.bag() } },
    exit: M.any(),
  });

  /** a seat for allocating proceeds of sales */
  const proceeds = zcf.makeEmptySeatKit().zcfSeat;

  /** @type {OfferHandler} */
  const tradeHandler = buyerSeat => {
    // give and want are guaranteed by Zoe to match proposalShape
    const { want } = buyerSeat.getProposal();

    sum(bagCounts(want.Items.value)) <= maxItems ||
      Fail`max ${q(maxItems)} items allowed: ${q(want.Items)}`;

    const newItems = itemMint.mintGains(want);
    atomicRearrange(
      zcf,
      harden([
        // price from buyer to proceeds
        [buyerSeat, proceeds, { Price: tradePrice }],
        // new items to buyer
        [newItems, buyerSeat, want],
      ]),
    );

    buyerSeat.exit(true);
    newItems.exit();
    return 'trade complete';
  };

  /**
   * Make an invitation to trade for items.
   *
   * Proposal Keywords used in offers using these invitations:
   *   - give: `Price`
   *   - want: `Items`
   */
  const makeTradeInvitation = () =>
    zcf.makeInvitation(tradeHandler, 'buy items', undefined, proposalShape);

  // Mark the publicFacet Far, i.e. reachable from outside the contract
  const publicFacet = Far('Items Public Facet', {
    makeTradeInvitation,
  });
  return harden({ publicFacet });
};
harden(start);
