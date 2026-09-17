// SPDX-License-Identifier: Apache-2.0
// Covers: orchestration/auto-stake-it.contract.js orchestration/auto-stake-it.flows.js orchestration/auto-stake-it-tap-kit.js

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { eventLoopIteration } from '@agoric/internal/src/testing-utils.js';
import { withChainCapabilities } from '@agoric/orchestration/src/chain-capabilities.js';
import fetchedChainInfo from '@agoric/orchestration/src/fetched-chain-info.js';
import { assetOn } from '@agoric/orchestration/src/utils/asset.js';
import { buildVTransferEvent } from '@agoric/orchestration/tools/ibc-mocks.ts';
import { heapVowE } from '@agoric/vow/vat.js';
import { E } from '@endo/far';

import { setupOrchestrationWithAssets, startZoeWith } from './support.js';

test('make accounts, then stake uatom that arrives at the local account', async t => {
  const env = await setupOrchestrationWithAssets(t);
  const {
    commonPrivateArgs,
    bootstrap: { storage },
    mocks: { transferBridge },
    utils: { inspectLocalBridge },
  } = env;
  const { zoe, installation } = await startZoeWith('orchestration/auto-stake-it.contract.js');
  const storageNode = await E(storage.rootNode).makeChildNode('auto-stake-it');
  // The tap forwards uatom that arrives from cosmoshub. setupOrchestrationTest's
  // chainInfo does not include cosmoshub, so pass the published fetched chain
  // info and register uatom as it appears on agoric.
  const chainInfo = withChainCapabilities(fetchedChainInfo);
  const { instance } = await E(zoe).startInstance(installation, undefined, {}, {
    ...commonPrivateArgs,
    chainInfo,
    assetInfo: harden([
      ...commonPrivateArgs.assetInfo,
      assetOn('uatom', 'cosmoshub', undefined, 'agoric', chainInfo),
    ]),
    storageNode,
  });
  const publicFacet = await E(zoe).getPublicFacet(instance);

  const seat = E(zoe).offer(E(publicFacet).makeAccountsInvitation(), {}, undefined, {
    chainName: 'cosmoshub',
    validator: { chainId: 'cosmoshub-4', value: 'cosmosvaloper1test', encoding: 'bech32' },
  });
  const { publicSubscribers, invitationMakers } = await heapVowE(seat).getOfferResult();
  t.truthy(invitationMakers);
  // setupOrchestrationTest allocates local account addresses with
  // makeTestAddress, so read the address rather than assume one.
  const localAddress = publicSubscribers.agoric.storagePath.split('.').pop();
  t.regex(localAddress, /^agoric1/);
  t.regex(publicSubscribers.cosmoshub.storagePath.split('.').pop(), /^cosmos1/);

  // An unknown denom is ignored by the tap.
  await E(transferBridge).fromBridge(
    buildVTransferEvent({ receiver: localAddress, target: localAddress, amount: 10n, denom: 'unknown-token' }),
  );
  await eventLoopIteration();
  t.not(inspectLocalBridge().at(-1).messages?.length, 1, 'unknown-token is ignored');

  // uatom from cosmoshub is forwarded to the remote account for staking.
  await E(transferBridge).fromBridge(
    buildVTransferEvent({ receiver: localAddress, target: localAddress, amount: 10n, denom: 'uatom' }),
  );
  await eventLoopIteration();
  const { messages } = inspectLocalBridge().at(-1);
  t.is(messages?.length, 1, 'one transfer to the remote account');
  t.like(messages[0], {
    '@type': '/ibc.applications.transfer.v1.MsgTransfer',
    receiver: 'cosmos1test',
    token: { amount: '10' },
  });
});
