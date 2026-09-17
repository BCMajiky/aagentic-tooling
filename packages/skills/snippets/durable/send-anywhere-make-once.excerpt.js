// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/send-anywhere.contract.js#L93-L98
// Excerpt of: orchestration/send-anywhere.contract.js#L100-L105, tested by test/orchestration-send-anywhere.test.js
// Shows singleton accounts created once with zone.makeOnce. Lines lifted unchanged from inside a module, for reading; not importable.

  const sharedLocalAccountP = zone.makeOnce('localAccount', () =>
    makeLocalAccount(),
  );
  // UNTIL https://github.com/Agoric/agoric-sdk/issues/9822.
  /** @type {any} nobleAccountP */
  const nobleAccountP = zone.makeOnce('nobleAccount', () => makeNobleAccount());
