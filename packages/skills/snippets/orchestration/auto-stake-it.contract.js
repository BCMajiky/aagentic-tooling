// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/auto-stake-it.contract.js
//
// Changed from upstream: the 6 relative imports of other @agoric/orchestration
// modules (`'../x'`) name the package (`'@agoric/orchestration/src/x'`), because
// this copy lives outside the package. Nothing else differs.

import {
  EmptyProposalShape,
  InvitationShape,
} from '@agoric/zoe/src/typeGuards.js';
import { M } from '@endo/patterns';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { preparePortfolioHolder } from '@agoric/orchestration/src/exos/portfolio-holder-kit.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { prepareStakingTap } from './auto-stake-it-tap-kit.js';
import * as flows from './auto-stake-it.flows.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';

/**
 * @import {Remote} from '@agoric/internal';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration/src/types.js';
 * @import {ZCF} from '@agoric/zoe';
 * @import {Marshaller} from '@agoric/internal/src/lib-chainStorage.js';
 */

/**
 * AutoStakeIt allows users to to create an auto-forwarding address that
 * transfers and stakes tokens on a remote chain when received.
 *
 * To be wrapped with `withOrchestration`.
 *
 * @param {ZCF} zcf
 * @param {OrchestrationPowers & {
 *   marshaller: Remote<Marshaller>;
 *   chainInfo?: Record<string, CosmosChainInfo>;
 *   assetInfo?: [Denom, DenomDetail & { brandKey?: string }][];
 * }} privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
const contract = async (
  zcf,
  privateArgs,
  zone,
  { chainHub, orchestrateAll, vowTools },
) => {
  const makeStakingTap = prepareStakingTap(
    zone.subZone('stakingTap'),
    vowTools,
  );
  const makePortfolioHolder = preparePortfolioHolder(
    zone.subZone('portfolio'),
    vowTools,
  );

  const { makeAccounts } = orchestrateAll(flows, {
    makeStakingTap,
    makePortfolioHolder,
    chainHub,
  });

  const publicFacet = zone.exo(
    'AutoStakeIt Public Facet',
    M.interface('AutoStakeIt Public Facet', {
      makeAccountsInvitation: M.callWhen().returns(InvitationShape),
    }),
    {
      makeAccountsInvitation() {
        return zcf.makeInvitation(
          makeAccounts,
          'Make Accounts',
          undefined,
          EmptyProposalShape,
        );
      },
    },
  );

  const creatorFacet = prepareChainHubAdmin(zone, chainHub);

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  return { publicFacet, creatorFacet };
};

export const start = withOrchestration(contract, { publishAccountInfo: true });
harden(start);

/** @typedef {typeof start} AutoStakeItSF */
