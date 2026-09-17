// SPDX-License-Identifier: Apache-2.0
// Upstream: dapp-offer-up@4ea27c5:contract/src/offer-up.contract.js, via examples/offer-up/src/offer-up.contract.js#L88-L97
// Excerpt of: zoe/offer-up.contract.js#L71-L80, tested by test/zoe-offer-up.test.js
// Shows terms validated through meta.customTermsShape. Lines lifted unchanged from inside a module, for reading; not importable.

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
