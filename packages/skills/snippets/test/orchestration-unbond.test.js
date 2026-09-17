// SPDX-License-Identifier: Apache-2.0
// Covers: orchestration/unbond.contract.js orchestration/unbond.flows.js

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { CodecHelper } from '@agoric/cosmic-proto';
import { QueryBalanceResponse } from '@agoric/cosmic-proto/cosmos/bank/v1beta1/query.js';
import { QueryDelegatorDelegationsResponse } from '@agoric/cosmic-proto/cosmos/staking/v1beta1/query.js';
import { MsgUndelegateResponse as MsgUndelegateResponseType } from '@agoric/cosmic-proto/cosmos/staking/v1beta1/tx.js';
import { MsgTransferResponse as MsgTransferResponseType } from '@agoric/cosmic-proto/ibc/applications/transfer/v1/tx.js';
import {
  buildMsgResponseString,
  buildQueryResponseString,
} from '@agoric/orchestration/tools/ibc-mocks.ts';
import { E } from '@endo/far';

import { setupOrchestrationWithAssets, startZoeWith } from './support.js';

const MsgUndelegateResponse = CodecHelper(MsgUndelegateResponseType);
const MsgTransferResponse = CodecHelper(MsgTransferResponseType);

// The ICQ and ICA acknowledgement mocks below are copied from
// agoric-sdk@cc25a29:packages/orchestration/test/examples/unbond.contract.test.ts.
test('unbond and transfer runs to completion against mocked acknowledgements', async t => {
  const {
    bootstrap: { timer },
    brands: { ist },
    commonPrivateArgs,
    mocks: { ibcBridge },
    utils: { vowTools: vt },
  } = await setupOrchestrationWithAssets(t);

  const buildMocks = () => {
    const makeDelegationsResponse = () =>
      buildQueryResponseString(QueryDelegatorDelegationsResponse, {
        delegationResponses: [
          {
            delegation: {
              delegatorAddress: 'cosmos1test',
              validatorAddress: 'cosmosvaloper1xyz',
              shares: '1000000',
            },
            balance: { denom: 'uosmo', amount: '1000000' },
          },
        ],
      });
    const makeUndelegateResponse = () =>
      buildMsgResponseString(MsgUndelegateResponse, {
        completionTime: { seconds: 3600n, nanos: 0 },
      });

    return {
      'eyJkYXRhIjoiQ2tNS0RRb0xZMjl6Ylc5ek1YUmxjM1FTTWk5amIzTnRiM011YzNSaGEybHVaeTUyTVdKbGRHRXhMbEYxWlhKNUwwUmxiR1ZuWVhSdmNrUmxiR1ZuWVhScGIyNXoiLCJtZW1vIjoiIn0=':
        makeDelegationsResponse(),
      'eyJ0eXBlIjoxLCJkYXRhIjoiQ2xzS0pTOWpiM050YjNNdWMzUmhhMmx1Wnk1Mk1XSmxkR0V4TGsxeloxVnVaR1ZzWldkaGRHVVNNZ29MWTI5emJXOXpNWFJsYzNRU0VXTnZjMjF2YzNaaGJHOXdaWEl4ZUhsNkdoQUtCWFZ2YzIxdkVnY3hNREF3TURBdyIsIm1lbW8iOiIifQ==':
        makeUndelegateResponse(),
      'eyJkYXRhIjoiQ2pvS0ZBb0xZMjl6Ylc5ek1YUmxjM1FTQlhWdmMyMXZFaUl2WTI5emJXOXpMbUpoYm1zdWRqRmlaWFJoTVM1UmRXVnllUzlDWVd4aGJtTmwiLCJtZW1vIjoiIn0=':
        buildQueryResponseString(QueryBalanceResponse, {
          balance: { denom: 'uosmo', amount: '1234' },
        }),
      'eyJ0eXBlIjoxLCJkYXRhIjoiQ25rS0tTOXBZbU11WVhCd2JHbGpZWFJwYjI1ekxuUnlZVzV6Wm1WeUxuWXhMazF6WjFSeVlXNXpabVZ5RWt3S0NIUnlZVzV6Wm1WeUVndGphR0Z1Ym1Wc0xUTXlOaG9OQ2dWMWIzTnRieElFTVRJek5DSUxZMjl6Ylc5ek1YUmxjM1FxREdOdmMyMXZjekYwWlhOME1USUFPSUR3MXRUQ3pySUciLCJtZW1vIjoiIn0=':
        buildMsgResponseString(MsgTransferResponse, {}),
    };
  };

  ibcBridge.setMockAck(buildMocks());

  const { zoe, installation } = await startZoeWith('orchestration/unbond.contract.js');
  const { publicFacet } = await E(zoe).startInstance(
    installation,
    { Stable: ist.issuer },
    {},
    commonPrivateArgs,
  );

  const inv = E(publicFacet).makeUnbondAndTransferInvitation();
  t.is((await E(zoe).getInvitationDetails(inv)).description, 'Unbond and transfer');

  const userSeat = await E(zoe).offer(inv, {}, {}, { validator: 'agoric1valopsfufu' });
  const resultP = vt.when(E(userSeat).getOfferResult());

  // Wait for the completionTime to pass
  timer.advanceBy(3600n * 1000n);

  t.is(await resultP, undefined);
});
