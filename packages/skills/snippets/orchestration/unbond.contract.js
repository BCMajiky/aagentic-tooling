// SPDX-License-Identifier: Apache-2.0
// Upstream: agoric-sdk@cc25a29:packages/orchestration/src/examples/unbond.contract.js
//
// Changed from upstream: the 3 relative imports of other @agoric/orchestration
// modules (`'../x'`) name the package (`'@agoric/orchestration/src/x'`), because
// this copy lives outside the package. Nothing else differs.

import { M } from '@endo/patterns';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import * as flows from './unbond.flows.js';

/**
 * @import {TimerService} from '@agoric/time';
 * @import {LocalChain} from '@agoric/vats/src/localchain.js';
 * @import {NameHub} from '@agoric/vats';
 * @import {Remote} from '@agoric/internal';
 * @import {Zone} from '@agoric/zone';
 * @import {CosmosInterchainService} from '@agoric/orchestration/src/exos/exo-interfaces.js';
 * @import {OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {ZCF} from '@agoric/zoe';
 * @import {StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {Marshaller} from '@agoric/internal/src/lib-chainStorage.js';
 */

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF} zcf
 * @param {{
 *   agoricNames: Remote<NameHub>;
 *   localchain: Remote<LocalChain>;
 *   orchestrationService: Remote<CosmosInterchainService>;
 *   storageNode: Remote<StorageNode>;
 *   marshaller: Remote<Marshaller>;
 *   timerService: Remote<TimerService>;
 * }} _privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
const contract = async (
  zcf,
  _privateArgs,
  zone,
  { orchestrateAll, zcfTools },
) => {
  const { unbondAndTransfer } = orchestrateAll(flows, { zcfTools });

  const publicFacet = zone.exo('publicFacet', undefined, {
    makeUnbondAndTransferInvitation() {
      return zcf.makeInvitation(
        unbondAndTransfer,
        'Unbond and transfer',
        undefined,
        harden({
          // Nothing to give; the funds come from undelegating
          give: {},
          want: {}, // XXX ChainAccount Ownable?
          exit: M.any(),
        }),
      );
    },
  });

  return harden({ publicFacet });
};

export const start = withOrchestration(contract, { publishAccountInfo: true });
harden(start);
