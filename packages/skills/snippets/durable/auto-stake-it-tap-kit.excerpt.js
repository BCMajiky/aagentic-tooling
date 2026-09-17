// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/auto-stake-it-tap-kit.js#L52-L130
// Excerpt of: orchestration/auto-stake-it-tap-kit.js#L59-L137, tested by test/orchestration-auto-stake-it.test.js
// Shows a multi-facet durable kind with zone.exoClassKit. Lines lifted unchanged from inside a module, for reading; not importable.

const prepareStakingTapKit = (zone, { watch }) => {
  return zone.exoClassKit(
    'StakingTapKit',
    {
      tap: M.interface('AutoStakeItTap', {
        receiveUpcall: M.call(M.record()).returns(
          M.or(VowShape, M.undefined()),
        ),
      }),
      transferWatcher: M.interface('TransferWatcher', {
        onFulfilled: M.call(M.any()).optional(M.bigint()).returns(VowShape),
      }),
    },
    /** @param {StakingTapState} initialState */
    initialState => {
      mustMatch(initialState, StakingTapStateShape);
      return harden(initialState);
    },
    {
      tap: {
        /**
         * Transfers from localAccount to stakingAccount, then delegates from
         * the stakingAccount to `validator` if the expected token (remoteDenom)
         * is received.
         *
         * @param {VTransferIBCEvent} event
         */
        receiveUpcall(event) {
          trace('receiveUpcall', event);

          // ignore packets from unknown channels
          if (event.packet.source_channel !== this.state.sourceChannel) {
            return;
          }

          const tx = /** @type {FungibleTokenPacketData} */ (
            JSON.parse(atob(event.packet.data))
          );
          trace('receiveUpcall packet data', tx);

          const { remoteDenom, localChainAddress } = this.state;
          // ignore outgoing transfers
          if (tx.receiver !== localChainAddress.value) {
            return;
          }
          // only interested in transfers of `remoteDenom`
          if (tx.denom !== remoteDenom) {
            return;
          }

          const { localAccount, localDenom, remoteChainAddress } = this.state;
          return watch(
            E(localAccount).transfer(remoteChainAddress, {
              denom: localDenom,
              value: BigInt(tx.amount),
            }),
            this.facets.transferWatcher,
            BigInt(tx.amount),
          );
        },
      },
      transferWatcher: {
        /**
         * @param {any} _result
         * @param {bigint} value the qty of uatom to delegate
         */
        onFulfilled(_result, value) {
          const { stakingAccount, validator, remoteDenom } = this.state;
          return watch(
            E(stakingAccount).delegate(validator, {
              denom: remoteDenom,
              value,
            }),
          );
        },
      },
    },
  );
};
