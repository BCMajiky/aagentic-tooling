// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/send-anywhere.contract.js#L100-L111
// Excerpt of: orchestration/send-anywhere.contract.js#L107-L118, tested by test/orchestration-send-anywhere.test.js
// Shows binding a flow to its host context with orchestrate. Lines lifted unchanged from inside a module, for reading; not importable.

  const sendAnywhere = orchestrate(
    'sendAnywhere',
    {
      log,
      chainHub,
      sharedLocalAccountP,
      nobleAccountP,
      USDC: brands.USDC,
      zoeTools,
    },
    sendIt,
  );
