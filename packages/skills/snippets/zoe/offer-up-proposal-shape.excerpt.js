// SPDX-License-Identifier: Apache-2.0
// Upstream: dapp-offer-up@4ea27c5:contract/src/offer-up.contract.js, via examples/offer-up/src/offer-up.contract.js#L126-L130
// Excerpt of: zoe/offer-up.contract.js#L109-L113, tested by test/zoe-offer-up.test.js
// Shows a proposal shape: give at least the price, want items of the contract brand. Lines lifted unchanged from inside a module, for reading; not importable.

  const proposalShape = harden({
    give: { Price: M.gte(tradePrice) },
    want: { Items: { brand: itemBrand, value: M.bag() } },
    exit: M.any(),
  });
