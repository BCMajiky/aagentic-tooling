// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/send-anywhere.contract.js#L113-L128
// Excerpt of: orchestration/send-anywhere.contract.js#L120-L135, tested by test/orchestration-send-anywhere.test.js
// Shows a public facet as a zone.exo with an interface guard. Lines lifted unchanged from inside a module, for reading; not importable.

  const publicFacet = zone.exo(
    'Send PF',
    M.interface('Send PF', {
      makeSendInvitation: M.callWhen().returns(InvitationShape),
    }),
    {
      makeSendInvitation() {
        return zcf.makeInvitation(
          sendAnywhere,
          'send',
          undefined,
          M.splitRecord({ give: SingleNatAmountRecord }),
        );
      },
    },
  );
