// SPDX-License-Identifier: Apache-2.0
// Covers: orchestration/basic-flows.contract.js orchestration/basic-flows.flows.js

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { E, getInterfaceOf } from '@endo/far';

import { setupOrchestrationWithAssets, startZoeWith } from './support.js';

const start = async t => {
  const env = await setupOrchestrationWithAssets(t);
  const { bld, ist } = env.brands;
  const { zoe, installation } = await startZoeWith('orchestration/basic-flows.contract.js');
  const storageNode = await E(env.bootstrap.storage.rootNode).makeChildNode('basic-flows');
  const { instance } = await E(zoe).startInstance(
    installation,
    { Stable: ist.issuer, Stake: bld.issuer },
    {},
    { ...env.commonPrivateArgs, storageNode },
  );
  const publicFacet = await E(zoe).getPublicFacet(instance);
  return { ...env, zoe, publicFacet, vt: env.utils.vowTools };
};

// The fake IBC network in setupOrchestrationTest reports `cosmos1test` for every
// remote (ICA) account, whichever chain it is on.
for (const [chainName, prefix] of [['agoric', 'agoric1'], ['osmosis', 'cosmos1test']]) {
  test(`makeOrchAccount on ${chainName} returns a continuing offer`, async t => {
    const { zoe, publicFacet, vt } = await start(t);
    const seat = E(zoe).offer(E(publicFacet).makeOrchAccountInvitation(), {}, undefined, { chainName });
    const { invitationMakers, publicSubscribers } = await vt.when(E(seat).getOfferResult());
    t.regex(getInterfaceOf(invitationMakers) ?? '', /invitationMakers/);
    t.regex(publicSubscribers.account.storagePath, new RegExp(`\\.basic-flows\\.${prefix}`));
  });
}

test('deposit to and withdraw from a local account', async t => {
  const { zoe, publicFacet, vt, brands: { ist }, utils: { pourPayment, inspectBankBridge } } = await start(t);
  const seat = E(zoe).offer(E(publicFacet).makeOrchAccountInvitation(), {}, undefined, { chainName: 'agoric' });
  const { invitationMakers } = await vt.when(E(seat).getOfferResult());

  const twenty = ist.make(20n);
  const depositSeat = E(zoe).offer(
    await E(invitationMakers).Deposit(),
    { give: { Stable: twenty }, want: {} },
    { Stable: await pourPayment(twenty) },
  );
  t.is(await vt.when(E(depositSeat).getOfferResult()), undefined);
  t.like(inspectBankBridge().at(-1), { type: 'VBANK_GIVE', denom: 'uist', amount: '20' });

  const withdrawSeat = E(zoe).offer(await E(invitationMakers).Withdraw(), {
    give: {},
    want: { Stable: twenty },
  });
  t.is(await vt.when(E(withdrawSeat).getOfferResult()), undefined);
  t.deepEqual(await ist.issuer.getAmountOf(E(withdrawSeat).getPayout('Stable')), twenty);
});
