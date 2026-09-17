// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/basic-flows.contract.js
//
// Changed from upstream: the 4 relative imports of other @agoric/orchestration
// modules (`'../x'`) name the package (`'@agoric/orchestration/src/x'`), because
// this copy lives outside the package. Nothing else differs.

/**
 * @file Primarily a testing fixture, but also serves as an example of how to
 *   leverage basic functionality of the Orchestration API with async-flow.
 */
import { InvitationShape } from '@agoric/zoe/src/typeGuards.js';
import { M } from '@endo/patterns';
import { preparePortfolioHolder } from '@agoric/orchestration/src/exos/portfolio-holder-kit.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import * as flows from './basic-flows.flows.js';

/**
 * @import {Remote} from '@agoric/internal';
 * @import {Zone} from '@agoric/zone';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {ZCF} from '@agoric/zoe';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {Marshaller} from '@agoric/internal/src/lib-chainStorage.js';
 */

/**
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
  const makePortfolioHolder = preparePortfolioHolder(
    zone.subZone('portfolio'),
    vowTools,
  );

  const orchFns = orchestrateAll(flows, { makePortfolioHolder });

  const publicFacet = zone.exo(
    'Basic Flows Public Facet',
    M.interface('Basic Flows PF', {
      makeOrchAccountInvitation: M.callWhen().returns(InvitationShape),
      makePortfolioAccountInvitation: M.callWhen().returns(InvitationShape),
    }),
    {
      makeOrchAccountInvitation() {
        return zcf.makeInvitation(
          orchFns.makeOrchAccount,
          'Make an Orchestration Account',
        );
      },
      makePortfolioAccountInvitation() {
        return zcf.makeInvitation(
          orchFns.makePortfolioAccount,
          'Make an Orchestration Account',
        );
      },
    },
  );

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  return { publicFacet };
};

export const start = withOrchestration(contract, { publishAccountInfo: true });
harden(start);

/** @typedef {typeof start} BasicFlowsSF */
