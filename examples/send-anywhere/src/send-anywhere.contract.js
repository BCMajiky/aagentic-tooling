// SPDX-License-Identifier: Apache-2.0
//
// Copied from Agoric/agoric-sdk at commit cc25a29 (tag agoric-upgrade-23a),
// packages/orchestration/src/examples/send-anywhere.contract.js.
//
// The only change is to the intra-package relative imports: paths that pointed
// at sibling modules inside @agoric/orchestration now name the package
// explicitly. @agoric/orchestration has no "exports" field and ships src/, so
// the deep paths resolve. Nothing else has been touched; this is a format B
// and SES smoke subject and is meant to be @agoric API-exact.

import { InvitationShape } from '@agoric/zoe/src/typeGuards.js';
import { E } from '@endo/far';
import { M } from '@endo/patterns';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { AnyNatAmountShape } from '@agoric/orchestration/src/typeGuards.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import {
  makeNobleAccount as makeNobleAccountFlow,
  sendIt,
} from './send-anywhere.flows.js';
import * as sharedFlows from './shared.flows.js';

/**
 * @import {Remote, Vow} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {ZCF} from '@agoric/zoe';
 * @import {Marshaller} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 */

export const SingleNatAmountRecord = M.and(
  M.recordOf(M.string(), AnyNatAmountShape, {
    numPropertiesLimit: 1,
  }),
  M.not(harden({})),
);
harden(SingleNatAmountRecord);

/**
 * Send assets currently in an ERTP purse to an account on another chain. This
 * currently supports IBC and CCTP transfers. It could eventually support other
 * protocols, like Axelar GMP or IBC Eureka.
 *
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF} zcf
 * @param {OrchestrationPowers & {
 *   assetInfo?: [Denom, DenomDetail & { brandKey?: string }][];
 *   chainInfo?: Record<string, CosmosChainInfo>;
 *   marshaller: Remote<Marshaller>;
 *   storageNode: Remote<StorageNode>;
 * }} privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
export const contract = async (
  zcf,
  privateArgs,
  zone,
  { chainHub, orchestrate, vowTools, zoeTools },
) => {
  const creatorFacet = prepareChainHubAdmin(zone, chainHub);

  // UNTIL https://github.com/Agoric/agoric-sdk/issues/9066
  const logNode = E(privateArgs.storageNode).makeChildNode('log');
  /** @type {(msg: string) => Vow<void>} */
  const log = msg => vowTools.watch(E(logNode).setValue(msg));

  const makeLocalAccount = orchestrate(
    'makeLocalAccount',
    {},
    sharedFlows.makeLocalAccount,
  );
  const makeNobleAccount = orchestrate(
    'makeNobleAccountFlow',
    {},
    makeNobleAccountFlow,
  );

  const { brands } = zcf.getTerms();

  /**
   * ensure ChainHub is populated before trying to use it in flows
   */
  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );
  /**
   * Set up a shared local account for use in async-flow functions. Typically,
   * exo initState functions need to resolve synchronously, but `makeOnce`
   * allows us to provide a Promise. When using this inside a flow, we must
   * await it to ensure the account is available for use.
   *
   * @type {any} sharedLocalAccountP expects a Promise but this is a vow UNTIL
   *   https://github.com/Agoric/agoric-sdk/issues/9822
   */
  const sharedLocalAccountP = zone.makeOnce('localAccount', () =>
    makeLocalAccount(),
  );
  // UNTIL https://github.com/Agoric/agoric-sdk/issues/9822.
  /** @type {any} nobleAccountP */
  const nobleAccountP = zone.makeOnce('nobleAccount', () => makeNobleAccount());
  // orchestrate uses the names on orchestrationFns to do a "prepare" of the associated behavior
  const sendAnywhere = orchestrate(
    'sendAnywhere',
    {
      log,
      chainHub,
      sharedLocalAccountP,
      nobleAccountP,
      USDC: brands.USDC,
      zoeTools,
    },
    sendIt,
  );

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

  return { publicFacet, creatorFacet };
};
harden(contract);

export const start = withOrchestration(contract, { publishAccountInfo: true });
harden(start);
