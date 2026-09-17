// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.flows.js#L28-L35
// Excerpt of: orchestration/basic-flows.flows.js#L35-L42, tested by test/orchestration-basic-flows.test.js
// Shows a flow that hands the new account back as a continuing offer. Lines lifted unchanged from inside a module, for reading; not importable.

export const makeOrchAccount = async (orch, _ctx, seat, { chainName }) => {
  trace('makeOrchAccount', chainName);
  seat.exit(); // no funds exchanged
  mustMatch(chainName, M.string());
  const remoteChain = await orch.getChain(chainName);
  const orchAccount = await remoteChain.makeAccount();
  return orchAccount.asContinuingOffer();
};
