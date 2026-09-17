// SPDX-License-Identifier: Apache-2.0
// Covers: orchestration/send-anywhere.contract.js orchestration/send-anywhere.flows.js orchestration/shared.flows.js

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { makeIssuerKit } from '@agoric/ertp';
import { E } from '@endo/far';
import { mustMatch } from '@endo/patterns';

import { SingleNatAmountRecord } from '../orchestration/send-anywhere.contract.js';
import { setupOrchestrationWithAssets, startZoeWith } from './support.js';

test('SingleNatAmountRecord accepts one nat amount and nothing else', t => {
  const { brand } = makeIssuerKit('IST');
  const amt = harden({ brand, value: 1n });
  t.notThrows(() => mustMatch(harden({ Kw: amt }), SingleNatAmountRecord));
  t.throws(() => mustMatch(harden({ A: amt, B: amt }), SingleNatAmountRecord), { message: /more than 1/ });
  t.throws(() => mustMatch(harden({}), SingleNatAmountRecord), { message: /fail negated pattern/ });
});

const start = async t => {
  const env = await setupOrchestrationWithAssets(t);
  const { ist } = env.brands;
  const { zoe, installation } = await startZoeWith('orchestration/send-anywhere.contract.js');
  const storageNode = await E(env.bootstrap.storage.rootNode).makeChildNode('sendAnywhere');
  const { instance } = await E(zoe).startInstance(
    installation,
    { Stable: ist.issuer },
    {},
    { ...env.commonPrivateArgs, storageNode },
  );
  const publicFacet = await E(zoe).getPublicFacet(instance);
  return { ...env, zoe, publicFacet, vt: env.utils.vowTools };
};

const send = async ({ zoe, publicFacet, brands: { ist }, utils: { pourPayment } }, value) => {
  const give = { Send: ist.make(value) };
  return E(zoe).offer(
    E(publicFacet).makeSendInvitation(),
    { give },
    { Send: await pourPayment(give.Send) },
    { chainName: 'osmosis', destAddr: 'osmo1destination' },
  );
};

test('send to osmosis completes when the transfer is acknowledged', async t => {
  const ctx = await start(t);
  const seat = await send(ctx, 100n);
  const { message } = await ctx.utils.transmitVTransferEvent('acknowledgementPacket', -1).then(
    () => ctx.utils.outgoingTransferAt(-1),
  );
  t.like(message, { receiver: 'osmo1destination', token: { denom: 'uist', amount: '100' } });
  t.is(await ctx.vt.when(E(seat).getOfferResult()), undefined);
  t.is((await ctx.brands.ist.issuer.getAmountOf(E(seat).getPayout('Send'))).value, 0n);
});

for (const [label, event, error] of [
  ['an acknowledgement error', 'acknowledgementPacket', 'simulated failure'],
  ['a timeout', 'timeoutPacket', undefined],
]) {
  test(`the offerer is refunded after ${label}`, async t => {
    const ctx = await start(t);
    const seat = await send(ctx, 42n);
    await ctx.utils.transmitVTransferEvent(event, -1, error);
    await t.throwsAsync(ctx.vt.when(E(seat).getOfferResult()), { message: /IBC Transfer failed/ });
    t.is((await ctx.brands.ist.issuer.getAmountOf(E(seat).getPayout('Send'))).value, 42n);
  });
}
