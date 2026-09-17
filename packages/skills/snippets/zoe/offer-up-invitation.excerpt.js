// SPDX-License-Identifier: Apache-2.0
// Upstream: dapp-offer-up@4ea27c5:contract/src/offer-up.contract.js, via examples/offer-up/src/offer-up.contract.js#L166-L173
// Excerpt of: zoe/offer-up.contract.js#L149-L156, tested by test/zoe-offer-up.test.js
// Shows an invitation with a proposal shape, on a Far public facet. Lines lifted unchanged from inside a module, for reading; not importable.

  const makeTradeInvitation = () =>
    zcf.makeInvitation(tradeHandler, 'buy items', undefined, proposalShape);

  // Mark the publicFacet Far, i.e. reachable from outside the contract
  const publicFacet = Far('Items Public Facet', {
    makeTradeInvitation,
  });
  return harden({ publicFacet });
