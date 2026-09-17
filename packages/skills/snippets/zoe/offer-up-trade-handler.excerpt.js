// SPDX-License-Identifier: Apache-2.0
// Upstream: dapp-offer-up@4ea27c5:contract/src/offer-up.contract.js, via examples/offer-up/src/offer-up.contract.js#L135-L157
// Excerpt of: zoe/offer-up.contract.js#L118-L140, tested by test/zoe-offer-up.test.js
// Shows an offer handler that mints and reallocates in one rearrangement (still the deprecated helper). Lines lifted unchanged from inside a module, for reading; not importable.

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
