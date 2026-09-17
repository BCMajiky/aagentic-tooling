// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/send-anywhere.flows.js#L90-L126
// Excerpt of: orchestration/send-anywhere.flows.js#L97-L133, tested by test/orchestration-send-anywhere.test.js
// Shows direct account calls in a flow, with the refund on failure. Lines lifted unchanged from inside a module, for reading; not importable.

  const recoverFailedTransfer = async e => {
    await withdrawToSeat(sharedLocalAccount, seat, give);
    const errorMsg = `IBC Transfer failed ${q(e)}`;
    void log(`ERROR: ${errorMsg}`);
    seat.fail(errorMsg);
    throw makeError(errorMsg);
  };

  if (info.namespace === 'cosmos') {
    const { chainId } = info;
    assert(typeof chainId === 'string', 'bad chainId');

    const [_a, _o, connection] = await chainHub.getChainsAndConnection(
      'agoric',
      chainName,
    );

    connection.counterparty || Fail`No IBC connection to ${chainName}`;

    void log(`got info for chain: ${chainName} ${chainId}`);

    await localTransfer(seat, sharedLocalAccount, give);
    void log(`completed transfer to localAccount`);

    try {
      await sharedLocalAccount.transfer(
        {
          value: destAddr,
          encoding: 'bech32',
          chainId,
        },
        { denom, value: amt.value },
      );
      void log(`completed transfer to ${destAddr}`);
    } catch (e) {
      return recoverFailedTransfer(e);
    }
